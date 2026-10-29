// Run only against the disposable Docker daemon provided by CI.
// Tests the same Compose text that users paste into Portainer's Web editor.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const http = require('node:http');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const api = 'http://127.0.0.1:9000/api';
const app = 'http://127.0.0.1:8080';
const stackName = 'weather-portainer-ci';
const password = randomBytes(24).toString('hex');
const report = { startedAt: new Date().toISOString(), checks: [], status: 'running' };
let token, endpoint, stack, secretDir, portainerStarted = false;
function docker(args, options = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}
async function request(route, options = {}) {
  const response = await fetch(api + route, {
    ...options,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers },
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error('Portainer ' + route.split('?')[0] + ' HTTP ' + response.status + ': ' + text.replaceAll(password, '[redacted]'));
  return text ? JSON.parse(text) : null;
}
function json(body) { return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
const auth = { Authorization: 'Basic ' + Buffer.from('weather:' + password).toString('base64') };
function hostStatus(host) {
  return new Promise((resolve, reject) => {
    const req = http.get(app, { headers: { ...auth, Host: host } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.setTimeout(10000, () => req.destroy(new Error('Host probe timed out')));
  });
}
async function ready() {
  for (let i = 0; i < 60; i++) {
    if (await fetch(app + '/healthz').then(r => r.ok).catch(() => false)) return;
    await delay(1000);
  }
  throw new Error('Weather container did not become ready');
}
(async () => {
  await fs.mkdir('test-results/portainer', { recursive: true });
  try {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'This test requires an isolated GitHub Actions runner');
    assert.ok(process.env.WEATHER_IMAGE, 'A locally built WEATHER_IMAGE is required');
    const compose = await fs.readFile('compose.portainer.yml', 'utf8');
    const missingEnv = { ...process.env };
    delete missingEnv.WEATHER_HOST; delete missingEnv.DASHBOARD_PASSWORD;
    assert.throws(() => docker(['compose', '-f', 'compose.portainer.yml', 'config', '--quiet'], { env: missingEnv }));
    docker(['compose', '-f', 'compose.portainer.yml', 'config', '--quiet'], { env: { ...process.env, WEATHER_HOST: '127.0.0.1', DASHBOARD_PASSWORD: password } });
    report.checks.push('Compose rejects missing required settings and accepts complete settings');
    secretDir = await fs.mkdtemp(path.join(os.tmpdir(), 'portainer-ci-'));
    const secretPath = path.join(secretDir, 'admin-password');
    await fs.writeFile(secretPath, password, { mode: 0o600 });
    docker(['run', '-d', '--name', 'portainer-ci', '-p', '127.0.0.1:9000:9000',
      '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', 'portainer-ci-data:/data',
      '-v', secretPath + ':/run/admin-password:ro',
      'portainer/portainer-ce:lts', '--http-enabled', '--admin-password-file', '/run/admin-password']);
    portainerStarted = true;
    let status;
    for (let i = 0; i < 90; i++) {
      try { status = await request('/status'); break; } catch { await delay(1000); }
    }
    assert.ok(status, 'Portainer did not start');
    report.portainerVersion = status.Version;
    report.portainerImage = docker(['image', 'inspect', 'portainer/portainer-ce:lts', '--format', '{{json .RepoDigests}}']);
    token = (await request('/auth', { method: 'POST', ...json({ Username: 'admin', Password: password }) })).jwt;
    const form = new FormData();
    form.set('Name', 'local-ci'); form.set('EndpointCreationType', '1'); form.set('URL', 'unix:///var/run/docker.sock');
    endpoint = (await request('/endpoints', { method: 'POST', body: form })).Id;
    const env = [
      { name: 'WEATHER_HOST', value: 'weather-ci.test' },
      { name: 'DASHBOARD_PASSWORD', value: password },
      { name: 'WEATHER_IMAGE', value: process.env.WEATHER_IMAGE },
    ];
    stack = await request('/stacks/create/standalone/string?endpointId=' + endpoint, {
      method: 'POST', ...json({ Name: stackName, StackFileContent: compose, Env: env }),
    });
    await ready();
    report.checks.push('Portainer CE deployed the image-only stack with web-editor environment variables');
    assert.equal((await fetch(app)).status, 401);
    const html = await (await fetch(app, { headers: auth })).text();
    assert.match(html, /bundle\.[a-f0-9]+\.js/);
    // Node fetch normalizes Host; use HTTP to send the exact header under test.
    assert.equal(await hostStatus('weather-ci.test'), 200);
    assert.equal(await hostStatus('unexpected.invalid'), 403);
    report.checks.push('Dashboard requires its password, serves the built UI, and rejects unexpected hosts');
    const saved = await fetch(app + '/settings', {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ weatherProvider: 'open-meteo', mapProvider: 'osm', startingLat: '0', startingLon: '0' }),
    });
    assert.equal(saved.status, 200);
    const cid = docker(['ps', '-q', '--filter', 'label=com.docker.compose.project=' + stackName]);
    assert.ok(cid && !cid.includes('\n'));
    assert.equal(docker(['exec', cid, 'id', '-u']), '1000');
    report.checks.push('Container runs as nonroot and saves a no-account configuration with zero coordinates');
    docker(['rm', '-f', cid]);
    await request('/stacks/' + stack.Id + '?endpointId=' + endpoint, {
      method: 'PUT', ...json({ StackFileContent: compose, Env: env, PullImage: false, Prune: false }),
    });
    await ready();
    const settings = await (await fetch(app + '/settings', { headers: auth })).json();
    assert.equal(settings.startingLat, '0'); assert.equal(settings.startingLon, '0');
    assert.equal(settings.weatherProvider, 'open-meteo'); assert.equal(settings.mapProvider, 'osm');
    report.checks.push('Portainer redeployment recreated the container and retained its named-volume settings');
    report.status = 'passed';
    console.log(JSON.stringify(report));
  } catch (e) {
    report.status = 'failed'; report.error = String(e.stack || e).replaceAll(password, '[redacted]');
    console.error(report.error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile('test-results/portainer/report.json', JSON.stringify(report, null, 2));
    if (stack && endpoint) await request('/stacks/' + stack.Id + '?endpointId=' + endpoint, { method: 'DELETE' }).catch(() => {});
    if (portainerStarted) { try { docker(['rm', '-f', 'portainer-ci']); } catch {} }
    if (secretDir) await fs.rm(secretDir, { recursive: true, force: true });
    for (const name of [stackName + '_weather-data', 'portainer-ci-data']) { try { docker(['volume', 'rm', name]); } catch {} }
  }
})();
