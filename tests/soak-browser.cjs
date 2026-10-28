const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');
const { openMeteoUrl, normalizeOpenMeteo } = require('../server/openMeteo');
const { radarFrames } = require('../server/providers');
const mode = process.argv[2] || 'preflight';
const minutes = Number(process.env.SOAK_MINUTES || 300);
const output = path.join(process.cwd(), 'test-results', 'soak-' + mode);
const result = { mode, startedAt: new Date().toISOString(), sourceCommit: process.env.GITHUB_SHA || null, durationMinutes: mode === 'soak' ? minutes : null, simulatedProviders: true, checks: [], failures: [], samples: [], liveChecks: [] };
let worker, browser, page, context, port = 0, dir, msgId = 0;
let clock = Date.UTC(2026, 9, 28, 23, 50), mapFail = false;
const errors = [], requestCounts = {}, priorUpstream = {};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPQtXT8DwAC5QGncRp09AAAAABJRU5ErkJggg==', 'base64');
const staleText = 'An update failed. Some displayed data is from the previous successful update.';
const base = () => `http://127.0.0.1:${port}`;
async function command(payload = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { worker.off('message', listener); reject(new Error('Worker response timeout')); }, 10000);
    function listener(m) { if (m.id !== id) return; clearTimeout(timeout); worker.off('message', listener); m.error ? reject(new Error(m.error)) : resolve(m.metrics); }
    worker.on('message', listener); worker.send({ ...payload, id });
  });
}
async function startWorker() {
  worker = fork(path.join(__dirname, 'soak-server.cjs'), [], { env: { ...process.env, SOAK_PORT: String(port), SOAK_SETTINGS_FILE: path.join(dir, 'settings.json') }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Worker startup timeout')), 10000);
    worker.once('exit', code => { clearTimeout(timeout); reject(new Error('Worker exited before startup: ' + code)); });
    worker.once('message', m => { clearTimeout(timeout); resolve(m.port); });
  });
  if (mode === 'preflight') await command({ clock });
}
async function stopWorker() {
  if (!worker || worker.exitCode !== null) return;
  const current = worker;
  await new Promise(resolve => { current.once('exit', resolve); current.kill('SIGTERM'); });
}
async function advance(n) {
  clock += n * 60000; await command({ clock }); await page.clock.fastForward(n * 60000); await sleep(500);
}
async function refreshed() {
  await page.getByText('Clear', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText(staleText, { exact: true }).waitFor({ state: 'hidden', timeout: 15000 });
  assert.equal(await page.locator('canvas').count(), 2);
}
async function checkpoint(label) {
  const metrics = await command();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const perf = await cdp.send('Performance.getMetrics'); await cdp.detach();
  const values = Object.fromEntries(perf.metrics.map(m => [m.name, m.value]));
  const sample = { label, at: new Date().toISOString(), serverRss: metrics.memory.rss, serverHeap: metrics.memory.heapUsed, browserHeap: values.JSHeapUsedSize, nodes: values.Nodes, cacheEntries: metrics.cacheEntries, inflight: metrics.inflight, upstream: { ...metrics.counters }, requests: { ...requestCounts } };
  result.samples.push(sample);
  if (sample.serverRss > 512 * 1024 * 1024 || sample.browserHeap > 256 * 1024 * 1024 || sample.cacheEntries > 64) result.failures.push({ label, reason: 'Memory/cache bound exceeded', sample });
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(result, null, 2));
  return metrics;
}
async function liveCheck(label) {
  // Only these explicit probes use external weather services; browser fixtures never do.
  for (const [name, url, validate] of [
    ['Open-Meteo', openMeteoUrl(13.94, 121.62), normalizeOpenMeteo],
    ['RainViewer metadata', 'https://api.rainviewer.com/public/weather-maps.json', radarFrames],
  ]) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error('HTTP ' + r.status); validate(await r.json()); result.liveChecks.push({ label, name, status: 'passed', at: new Date().toISOString() }); }
    catch (e) { result.liveChecks.push({ label, name, status: 'unavailable', reason: e.message, at: new Date().toISOString() }); }
  }
}
async function preflight() {
  for (const failure of ['503', '429', 'timeout', 'malformed']) {
    await command({ weatherMode: failure, clear: true }); await advance(61);
    await page.getByText(staleText, { exact: true }).waitFor();
    assert.equal(await page.locator('canvas').count(), 2, 'Retained charts should stay visible');
    if (failure === '429') {
      const before = (await command()).counters['api.open-meteo.com'];
      const r = await fetch(base() + '/api/weather?lat=0&lon=0&kind=current'); assert.equal(r.status, 429);
      assert.equal((await command()).counters['api.open-meteo.com'], before, 'Cooldown must avoid another provider request');
    }
    await command({ weatherMode: 'ok' }); await advance(61); await refreshed();
    result.checks.push('Weather ' + failure + ': retains data, marks failure, recovers on scheduled refresh');
  }
  await command({ radarMode: '503', clear: true }); await advance(11);
  await page.getByText('Radar unavailable; retrying on the next update.', { exact: true }).waitFor();
  await command({ radarMode: 'ok' }); await advance(11);
  await page.getByText('Radar unavailable; retrying on the next update.', { exact: true }).waitFor({ state: 'hidden' });
  result.checks.push('Radar outage and automatic metadata recovery');
  mapFail = true; await page.locator('.leaflet-control-zoom-out').click();
  await page.getByText('Base map unavailable. Weather remains available.', { exact: true }).waitFor();
  await sleep(500); // Let Leaflet finish its zoom transition before the recovery navigation.
  mapFail = false; await page.locator('.leaflet-control-zoom-out').click();
  await page.getByText('Base map unavailable. Weather remains available.', { exact: true }).waitFor({ state: 'hidden' });
  result.checks.push('Map tile failure feedback and recovery after navigating to new tiles (not automatic retry of failed tiles)');
  await context.setOffline(true); await advance(61);
  await page.getByText(staleText, { exact: true }).waitFor();
  await context.setOffline(false); await advance(61); await refreshed();
  result.checks.push('Browser offline/online: scheduled weather recovery');
  const before = (await command()).counters;
  for (const [k, v] of Object.entries(before)) priorUpstream[k] = (priorUpstream[k] || 0) + v;
  await stopWorker(); await startWorker(); await advance(61); await refreshed();
  const saved = await (await fetch(base() + '/settings')).json();
  assert.equal(saved.weatherProvider, 'open-meteo'); assert.equal(saved.mapProvider, 'osm'); assert.equal(saved.startingLat, '0');
  result.checks.push('Server recreation on same port: scheduled recovery and settings retention');
  await advance(24 * 60); await refreshed();
  assert.equal(new Date(await page.evaluate(() => Date.now())).getUTCDate(), new Date(clock).getUTCDate());
  result.checks.push('24-hour clock jump: refresh timers and weather panels remain functional');
  await page.screenshot({ path: path.join(output, 'preflight-complete.png') });
  await checkpoint('preflight-complete');
}
async function soak() {
  assert.ok(Number.isFinite(minutes) && minutes >= 1 && minutes <= 310);
  await liveCheck('start');
  await page.getByRole('button', { name: 'Animate past radar', exact: true }).click();
  const started = Date.now(); let lastMode = '', offline = false, restarted = false;
  console.log(`SOAK_RUNNING: real browser timers, ${minutes}-minute target, synthetic providers, bounded live probes.`);
  for (let n = 0; n <= minutes; n++) {
    await sleep(Math.max(0, started + n * 60000 - Date.now()));
    const weatherMode = n >= 25 && n < 42 ? '503' : n >= 100 && n < 112 ? '429' : 'ok';
    const radarMode = n >= 60 && n < 77 ? '503' : 'ok';
    const signature = weatherMode + radarMode;
    if (signature !== lastMode) { await command({ weatherMode, radarMode }); lastMode = signature; result.checks.push({ minute: n, weatherMode, radarMode }); }
    const shouldOffline = n >= 145 && n < 152;
    if (shouldOffline !== offline) { await context.setOffline(shouldOffline); offline = shouldOffline; result.checks.push({ minute: n, browserOffline: offline }); }
    if (n >= 200 && !restarted) {
      const m = await command(); for (const [k, v] of Object.entries(m.counters)) priorUpstream[k] = (priorUpstream[k] || 0) + v;
      await stopWorker(); await startWorker(); restarted = true; lastMode = '';
      result.checks.push({ minute: n, serverRestarted: true });
    }
    const metrics = await checkpoint('minute-' + n);
    if (n % 15 === 0) console.log(JSON.stringify({ minute: n, rssMiB: Math.round(metrics.memory.rss / 1024 / 1024), upstream: metrics.counters, failures: result.failures.length }));
    if ([45, 115, 151].includes(n) && !await page.getByText(staleText, { exact: true }).isVisible()) result.failures.push({ minute: n, reason: 'Expected stale-data notice during injected failure' });
    if (n === 75 && !await page.getByText('Radar unavailable; retrying on the next update.', { exact: true }).isVisible()) result.failures.push({ minute: n, reason: 'Expected radar failure notice' });
    if ([55, 95, 135, 175, 225, minutes].includes(n)) {
      try { await refreshed(); assert.equal((await (await fetch(base() + '/settings')).json()).startingLat, '0'); }
      catch (e) { result.failures.push({ minute: n, reason: e.message }); }
    }
  }
  const metrics = await command();
  result.upstreamTotals = Object.fromEntries([...new Set([...Object.keys(priorUpstream), ...Object.keys(metrics.counters)])].map(k => [k, (priorUpstream[k] || 0) + (metrics.counters[k] || 0)]));
  result.browserRequests = requestCounts;
  if (minutes >= 300) {
    if ((requestCounts.current || 0) < 25 || (requestCounts.hourly || 0) < 5 || (requestCounts.daily || 0) < 5) result.failures.push({ reason: 'Refresh counts below expected range', requestCounts });
    if ((result.upstreamTotals['api.open-meteo.com'] || 0) > 48) result.failures.push({ reason: 'Open-Meteo request budget exceeded', totals: result.upstreamTotals });
    const baseline = result.samples.find(s => s.label === 'minute-15'), final = result.samples.at(-1);
    if (baseline && final.browserHeap - baseline.browserHeap > 64 * 1024 * 1024) result.failures.push({ reason: 'Browser heap grew by more than 64 MiB after warmup' });
    if (baseline && final.nodes - baseline.nodes > 1000) result.failures.push({ reason: 'DOM node count grew by more than 1000 after warmup' });
  }
  await page.screenshot({ path: path.join(output, 'soak-complete.png') });
  await liveCheck('finish');
}
(async () => {
  await fs.mkdir(output, { recursive: true }); dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weather-soak-'));
  await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify({ weatherProvider: 'open-meteo', mapProvider: 'osm', startingLat: '0', startingLon: '0' }), { mode: 0o600 });
  try {
    await startWorker();
    browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
    context = await browser.newContext({ viewport: { width: 800, height: 480 }, timezoneId: 'UTC', locale: 'en-US' });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    if (mode === 'preflight') await page.clock.install({ time: new Date(clock) });
    page.on('pageerror', e => errors.push(e.message)); page.on('crash', () => errors.push('Browser page crashed'));
    page.on('request', r => { const u = new URL(r.url()); if (u.pathname === '/api/weather') { const k = u.searchParams.get('kind'); requestCounts[k] = (requestCounts[k] || 0) + 1; } });
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.origin === base()) return route.continue();
      if (u.hostname === 'api.sunrise-sunset.org') return route.fulfill({ json: { results: { sunrise: '2026-10-28T06:00:00Z', sunset: '2026-10-28T18:00:00Z' }, status: 'OK' } });
      if (['tile.openstreetmap.org', 'tilecache.rainviewer.com'].includes(u.hostname)) {
        if (mapFail && u.hostname === 'tile.openstreetmap.org') return route.fulfill({ status: 503, body: '' });
        return route.fulfill({ contentType: 'image/png', body: png });
      }
      errors.push('Unexpected external browser host: ' + u.hostname); return route.abort();
    });
    await page.goto(base()); await refreshed(); await checkpoint('initial');
    if (mode === 'preflight') await preflight(); else await soak();
    assert.deepEqual(errors, []); result.status = result.failures.length ? 'failed' : 'passed';
    if (result.failures.length) process.exitCode = 1;
  } catch (e) { result.status = 'failed'; result.failures.push({ reason: e.stack || e.message }); process.exitCode = 1; if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); }
  finally {
    result.finishedAt = new Date().toISOString(); result.browserErrors = errors;
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: result.status, checks: result.checks, failures: result.failures, liveChecks: result.liveChecks }));
    if (browser) await browser.close(); await stopWorker(); if (dir) await fs.rm(dir, { recursive: true, force: true });
  }
})();
