const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { createApp } = require('../server');
const { SettingsStore, MASK } = require('../server/settingsCtrl');
const { Providers, radarFrames } = require('../server/providers');
const fixture = require('./fixtures.cjs');
async function setup(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weather-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new SettingsStore(path.join(dir, 'settings.json'));
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(fixture.response(url, init)), { headers: { 'Content-Type': 'application/json' } });
  };
  const app = createApp({ store, providerOptions: { fetchImpl }, ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, method = 'GET', body, headers = {}) => fetch(base + route, {
    method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  return { dir, store, calls, request, base };
}
const privateValues = { weatherApiKey: 'private-weather-key', reverseGeoApiKey: 'private-location-key', mapApiKey: 'pk.public-map-token', startingLat: '0', startingLon: '0' };
test('first run returns empty settings instead of leaving setup pending', async t => {
  const { request } = await setup(t); const r = await request('/settings');
  assert.equal(r.status, 200); assert.equal((await r.json()).weatherApiKey, '');
});
test('create, save, restart: private keys are masked and retained on disk', async t => {
  const { request, store } = await setup(t);
  let r = await request('/settings', 'POST', privateValues); assert.equal(r.status, 201);
  const data = await r.json(); assert.equal(data.weatherApiKey, MASK); assert.equal(data.reverseGeoApiKey, MASK);
  assert.equal(data.mapApiKey, privateValues.mapApiKey);
  r = await request('/settings', 'PUT', { weatherApiKey: MASK, reverseGeoApiKey: MASK, startingLat: '39.65' });
  assert.equal(r.status, 200);
  const restarted = new SettingsStore(store.filename); assert.equal((await restarted.read()).weatherApiKey, privateValues.weatherApiKey);
  assert.equal((await fs.stat(store.filename)).mode & 0o777, 0o600);
  assert.equal((await request('/settings', 'POST', privateValues)).status, 409);
});
test('clearing a private key works without returning its old value', async t => {
  const { request, store } = await setup(t); await store.update(privateValues);
  const r = await request('/settings', 'PUT', { weatherApiKey: '' });
  assert.equal((await r.json()).weatherApiKey, ''); assert.equal((await store.read()).weatherApiKey, '');
});
test('placeholder without a saved key is rejected', async t => {
  const { request } = await setup(t);
  assert.equal((await request('/settings', 'PUT', { weatherApiKey: MASK })).status, 400);
});
test('invalid settings cannot overwrite a working configuration', async t => {
  const { request, store } = await setup(t); await store.update(privateValues);
  for (const input of [{ mapApiKey: 'sk.secret' }, { startingLat: 91 }, { startingLon: -181 }, { bad: 'key' }, { weatherApiKey: {} }, { weatherApiKey: 'x'.repeat(513) }]) {
    assert.equal((await request('/settings', 'PUT', input)).status, 400);
    assert.equal((await store.read()).weatherApiKey, privateValues.weatherApiKey);
  }
});
test('malformed and oversized JSON requests fail cleanly', async t => {
  const { request } = await setup(t);
  assert.equal((await request('/settings', 'PUT', '{broken')).status, 400);
  assert.equal((await request('/settings', 'PUT', { weatherApiKey: 'x'.repeat(9000) })).status, 413);
});
test('corrupt settings are not overwritten and no stack is exposed', async t => {
  const { request, store } = await setup(t); await fs.writeFile(store.filename, '{broken');
  const r = await request('/settings', 'PUT', privateValues);
  assert.equal(r.status, 500); assert.equal(await fs.readFile(store.filename, 'utf8'), '{broken');
  const text = await r.text(); assert.ok(!text.includes(store.filename)); assert.ok(!text.includes('SyntaxError'));
});
test('concurrent partial updates serialize without losing fields', async t => {
  const { store } = await setup(t);
  await Promise.all([store.update({ weatherApiKey: 'a' }), store.update({ reverseGeoApiKey: 'b' }), store.update({ mapApiKey: 'pk.c' })]);
  assert.deepEqual(await store.read(), { weatherApiKey: 'a', reverseGeoApiKey: 'b', mapApiKey: 'pk.c' });
});
test('patch and delete support zero coordinates and empty values', async t => {
  const { request, store } = await setup(t);
  assert.equal((await request('/setting', 'PATCH', { key: 'startingLat', val: 0 })).status, 200);
  assert.equal((await store.read()).startingLat, '0');
  assert.equal((await request('/setting?key=startingLat', 'DELETE', {})).status, 200);
  assert.equal((await store.read()).startingLat, '');
});
test('cross-origin requests, form writes and untrusted Hosts are blocked', async t => {
  const { request, base } = await setup(t);
  assert.equal((await request('/settings', 'GET', undefined, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await request('/settings', 'PUT', 'x=y', { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 415);
  const status = await new Promise((resolve, reject) => {
    http.get(base + '/settings', { headers: { Host: 'evil.test' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(status, 403);
  const r = await request('/settings'); assert.equal(r.headers.get('access-control-allow-origin'), null);
});
test('additional hostnames require a password at startup', () => {
  assert.throws(() => createApp({ allowedHosts: ['weather.local'], password: '' }), /DASHBOARD_PASSWORD/);
});
test('optional Basic authentication protects dashboard and API', async t => {
  const { request } = await setup(t, { password: 'a-long-test-password' });
  assert.equal((await request('/')).status, 401); assert.equal((await request('/settings')).status, 401);
  const r = await request('/settings', 'GET', undefined, { Authorization: 'Basic ' + Buffer.from('weather:a-long-test-password').toString('base64') });
  assert.equal(r.status, 200);
  assert.equal((await request('/healthz')).status, 200);
});
test('explicit Tomorrow.io needs a key; invalid coordinates never call upstream', async t => {
  const { request, calls, store } = await setup(t);
  await store.update({ weatherProvider: 'tomorrow' });
  for (const route of ['/api/weather?lat=&lon=0&kind=current', '/api/weather?lat=91&lon=0&kind=current', '/api/weather?lat=0&lon=0&kind=bad']) assert.equal((await request(route)).status, 400);
  assert.equal((await request('/api/weather?lat=0&lon=0&kind=current')).status, 422);
  assert.equal(calls.length, 0);
});
test('all weather modes call Tomorrow.io in metric units and sanitize responses', async t => {
  const { request, calls, store } = await setup(t); await store.update(privateValues);
  for (const kind of ['current', 'hourly', 'daily']) {
    const r = await request(`/api/weather?lat=0&lon=0&kind=${kind}`); assert.equal(r.status, 200);
    const text = await r.text(); assert.ok(!text.includes('private-')); assert.ok(!text.includes('debugSecret'));
    const data = JSON.parse(text); assert.ok(data.data.timelines[0].intervals.length);
  }
  assert.equal(calls.length, 3);
  for (const { url, init } of calls) {
    assert.equal(new URL(url).hostname, 'api.tomorrow.io'); assert.equal(init.method, 'POST');
    assert.equal(JSON.parse(init.body).units, 'metric'); assert.deepEqual(JSON.parse(init.body).location, [0, 0]); assert.equal(init.redirect, 'error');
  }
});
test('weather cache deduplicates concurrent calls and updates after credential change', async t => {
  const { request, calls, store } = await setup(t); await store.update(privateValues);
  const route = '/api/weather?lat=0&lon=0&kind=current';
  await Promise.all([request(route), request(route), request(route)]); assert.equal(calls.length, 1);
  await request('/settings', 'PUT', { weatherApiKey: 'replacement-key' });
  await request(route); assert.equal(calls.length, 2); assert.ok(calls[1].url.includes('replacement-key'));
});
test('weather cache expires and has a bounded size', async t => {
  const { store } = await setup(t); await store.update(privateValues); let now = 0; let count = 0;
  const provider = new Providers(store, { now: () => now, fetchImpl: async (url, init) => { count++; return new Response(JSON.stringify(fixture.response(url, init))); } });
  await provider.weather({ lat: '0', lon: '0', kind: 'current' }); now = 600001;
  await provider.weather({ lat: '0', lon: '0', kind: 'current' }); assert.equal(count, 2);
  for (let i = 1; i < 70; i++) await provider.weather({ lat: String(i), lon: '0', kind: 'current' });
  assert.equal(provider.cache.size, 64);
});
test('upstream HTTP, malformed, incomplete and oversized responses do not leak keys', async t => {
  const { store } = await setup(t); await store.update(privateValues);
  for (const response of [new Response('private-weather-key', { status: 403 }), new Response('not JSON'), new Response('{}'), new Response('x'.repeat(2100000))]) {
    const provider = new Providers(store, { fetchImpl: async () => response });
    await assert.rejects(provider.weather({ lat: '0', lon: '0', kind: 'current' }), error => !error.message.includes('private-weather-key') && [424, 502].includes(error.status));
  }
});
test('provider rate-limit cooldown honors Retry-After without another call', async t => {
  const { store } = await setup(t); await store.update(privateValues); let count = 0;
  const provider = new Providers(store, { fetchImpl: async () => { count++; return new Response('', { status: 429, headers: { 'Retry-After': '120' } }); } });
  for (let i = 0; i < 2; i++) await assert.rejects(provider.weather({ lat: '0', lon: '0', kind: 'current' }), e => e.status === 429);
  assert.equal(count, 1);
});
test('provider network timeout is bounded with a real local HTTP server', async t => {
  const { store } = await setup(t); await store.update(privateValues);
  const slow = http.createServer((_req, res) => { const timer = setTimeout(() => res.end('{}'), 1000); timer.unref(); });
  slow.listen(0, '127.0.0.1'); await new Promise(resolve => slow.once('listening', resolve));
  t.after(() => new Promise(resolve => { slow.closeAllConnections(); slow.close(resolve); }));
  const provider = new Providers(store, { timeout: 30, fetchImpl: (_url, init) => fetch(`http://127.0.0.1:${slow.address().port}`, init) });
  await assert.rejects(provider.weather({ lat: '0', lon: '0', kind: 'current' }), /timed out/);
});
test('radar uses current past-frame metadata and caches it', async t => {
  const { request, calls } = await setup(t);
  const r = await request('/api/radar'); assert.equal(r.status, 200);
  const frames = await r.json(); assert.equal(frames[0].url, 'https://tilecache.rainviewer.com/v2/radar/266d4e9ea76f');
  await request('/api/radar'); assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith('/public/weather-maps.json'));
});
test('radar parser rejects unknown hosts and empty frames', () => {
  for (const data of [{ host: 'https://evil.test', radar: { past: [] } }, { host: 'https://tilecache.rainviewer.com', radar: { past: [] } }]) assert.throws(() => radarFrames(data));
});
test('reverse geocoding sends private key only from server and filters response', async t => {
  const { request, calls, store } = await setup(t); await store.update(privateValues);
  const r = await request('/api/reverse?lat=0&lon=0'); assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { address: { city: 'Fixture City', country: 'Test' } });
  assert.ok(calls[0].url.includes('private-location-key'));
});
test('removed IP geolocation is replaced by configured coordinates, including zero', async t => {
  const { request, store, calls } = await setup(t);
  assert.equal((await request('/geolocation')).status, 422);
  await store.update({ startingLat: '0', startingLon: '0' });
  assert.deepEqual(await (await request('/geolocation')).json(), { latitude: 0, longitude: 0 }); assert.equal(calls.length, 0);
});
test('settings path and source files cannot be downloaded as static assets', async t => {
  const { request } = await setup(t);
  assert.equal((await request('/settings.json')).status, 404);
  assert.equal((await request('/server/index.js')).status, 404);
});
test('failed settings rename preserves old file and removes the temporary file', async t => {
  const { store, dir } = await setup(t); await store.update(privateValues);
  const mock = t.mock.method(fs, 'rename', async () => { throw new Error('simulated disk failure'); });
  await assert.rejects(store.update({ weatherApiKey: 'replacement-key' })); mock.mock.restore();
  assert.equal((await store.read()).weatherApiKey, privateValues.weatherApiKey);
  assert.deepEqual((await fs.readdir(dir)).sort(), ['settings.json']);
});
test('migration helper imports settings once and refuses an overwrite', async t => {
  const { dir } = await setup(t);
  const source = path.join(dir, 'export.json'), target = path.join(dir, 'new/settings.json');
  await fs.writeFile(source, JSON.stringify(privateValues));
  const command = () => spawnSync(process.execPath, [path.join(__dirname, '../scripts/import-settings.js'), source], { env: { ...process.env, SETTINGS_FILE: target }, encoding: 'utf8' });
  let r = command(); assert.equal(r.status, 0, r.stderr); assert.ok(!r.stdout.includes('private-'));
  assert.deepEqual(JSON.parse(await fs.readFile(target)), privateValues);
  r = command(); assert.equal(r.status, 1); assert.deepEqual(JSON.parse(await fs.readFile(target)), privateValues);
});
test('migration helper rejects malformed exports without creating settings', async t => {
  const { dir } = await setup(t);
  const source = path.join(dir, 'export.json'), target = path.join(dir, 'new/settings.json');
  await fs.writeFile(source, '{bad private-key');
  const r = spawnSync(process.execPath, [path.join(__dirname, '../scripts/import-settings.js'), source], { env: { ...process.env, SETTINGS_FILE: target }, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.ok(!r.stderr.includes('private-key'));
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
});

test('radar paths are opaque IDs, not necessarily frame timestamps', () => {
  const base = { host: 'https://tilecache.rainviewer.com', radar: { past: [{ time: 1793067600, path: '/v2/radar/266d4e9ea76f' }] } };
  assert.equal(radarFrames(base)[0].url, 'https://tilecache.rainviewer.com/v2/radar/266d4e9ea76f');
  for (const path of ['/v2/radar/../private', '/v2/radar/id?url=evil', '//evil.test/frame']) {
    assert.throws(() => radarFrames({ ...base, radar: { past: [{ time: 1793067600, path }] } }));
  }
});


test('new settings choose no-account providers; existing keys retain their providers', async t => {
  const { request, store } = await setup(t);
  let s = await (await request('/settings')).json();
  assert.equal(s.weatherProvider, 'open-meteo'); assert.equal(s.mapProvider, 'osm');
  await store.update(privateValues);
  s = await (await request('/settings')).json();
  assert.equal(s.weatherProvider, 'tomorrow'); assert.equal(s.mapProvider, 'mapbox');
  await request('/settings', 'PUT', { weatherProvider: 'open-meteo', mapProvider: 'osm' });
  s = await (await request('/settings')).json();
  assert.equal(s.weatherProvider, 'open-meteo'); assert.equal(s.mapProvider, 'osm');
  assert.equal((await store.read()).weatherApiKey, privateValues.weatherApiKey);
});
test('no-account weather works for all panels with one shared upstream request', async t => {
  const { request, calls } = await setup(t);
  const data = await Promise.all(['current', 'hourly', 'daily'].map(async kind => {
    const r = await request(`/api/weather?lat=0&lon=0&kind=${kind}`); assert.equal(r.status, 200); return r.json();
  }));
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.hostname, 'api.open-meteo.com'); assert.equal(url.searchParams.has('apikey'), false);
  assert.equal(url.searchParams.get('wind_speed_unit'), 'ms'); assert.equal(url.searchParams.get('timeformat'), 'unixtime');
  assert.deepEqual(data.map(d => d.data.timelines[0].intervals.length), [1, 24, 5]);
  assert.ok(data.every(d => d.provider === 'open-meteo'));
});
test('Open-Meteo uses current forecast hour, metric values, and daily totals', () => {
  const { normalizeOpenMeteo } = require('../server/openMeteo');
  const data = fixture.openMeteo(); data.hourly.precipitation_probability[12] = 73;
  const n = normalizeOpenMeteo(data);
  const current = n.current.data.timelines[0].intervals[0];
  assert.equal(current.values.temperature, 20); assert.equal(current.values.windSpeed, 3);
  assert.equal(current.values.precipitationProbability, 73); assert.equal(current.values.weatherCode, 1000);
  const hourly = n.hourly.data.timelines[0].intervals;
  assert.equal(Date.parse(hourly[0].startTime) / 1000, data.hourly.time[12]);
  assert.equal(hourly[0].values.precipitationIntensity, 1.5);
  const daily = n.daily.data.timelines[0].intervals[0].values;
  assert.equal(daily.temperature, 18); assert.equal(daily.windSpeed, 5); assert.equal(daily.precipitationAmount, 12);
  assert.equal(daily.precipitationIntensity, undefined);
});
test('WMO snow, freezing rain, thunderstorms and unknown conditions remain distinct', () => {
  const { normalizeOpenMeteo } = require('../server/openMeteo');
  for (const [wmo, expected, description] of [[75, 5101, 'Heavy snow'], [66, 6200, 'Light freezing rain'], [96, 8000, 'Thunderstorm with hail'], [999, -1, 'Conditions unavailable']]) {
    const data = fixture.openMeteo(); data.current.weather_code = wmo; data.current.is_day = 0;
    const v = normalizeOpenMeteo(data).current.data.timelines[0].intervals[0].values;
    assert.equal(v.weatherCode, expected); assert.equal(v.conditionText, description); assert.equal(v.isDay, false);
    if (wmo === 75) assert.equal(v.precipitationType, 2);
  }
});
test('missing, null, misaligned or invalid Open-Meteo values are not rendered as zero', () => {
  const { normalizeOpenMeteo } = require('../server/openMeteo');
  for (const damage of [d => d.current.temperature_2m = null, d => d.current.relative_humidity_2m = 101,
    d => d.hourly.precipitation = [], d => d.hourly.time[1] = d.hourly.time[0],
    d => d.daily.precipitation_sum[0] = -1, d => d.current.time = 0,
    d => d.hourly.time = d.hourly.time.slice(0, 15), d => d.daily.time = [],
    d => d.current.is_day = null]) {
    const data = fixture.openMeteo(); damage(data);
    assert.throws(() => normalizeOpenMeteo(data), e => e.status === 502);
  }
});
test('Open-Meteo cache expires and rate limits back off across all panel requests', async t => {
  const { store } = await setup(t); let now = 0, calls = 0, limited = false;
  const provider = new Providers(store, { now: () => now, fetchImpl: async () => {
    calls++; return limited ? new Response('', { status: 429, headers: { 'Retry-After': '120' } }) : new Response(JSON.stringify(fixture.openMeteo()));
  } });
  await provider.weather({ lat: '0', lon: '0', kind: 'current' });
  await provider.weather({ lat: '0', lon: '0', kind: 'daily' }); assert.equal(calls, 1);
  now = 600001; await provider.weather({ lat: '0', lon: '0', kind: 'hourly' }); assert.equal(calls, 2);
  now += 600001; limited = true;
  for (const kind of ['current', 'hourly', 'daily']) await assert.rejects(provider.weather({ lat: '0', lon: '0', kind }), e => e.status === 429);
  assert.equal(calls, 3);
});
test('provider selection validates enums and preserves secrets through switching', async t => {
  const { request, store, calls } = await setup(t); await store.update(privateValues);
  for (const input of [{ weatherProvider: 'other' }, { mapProvider: 'javascript:evil' }]) assert.equal((await request('/settings', 'PUT', input)).status, 400);
  await request('/settings', 'PUT', { weatherProvider: 'open-meteo', weatherApiKey: MASK });
  await request('/api/weather?lat=0&lon=0&kind=current'); assert.equal(new URL(calls[0].url).hostname, 'api.open-meteo.com');
  await request('/settings', 'PUT', { weatherProvider: 'tomorrow', weatherApiKey: MASK });
  await request('/api/weather?lat=0&lon=0&kind=current'); assert.equal(new URL(calls[1].url).hostname, 'api.tomorrow.io');
  assert.equal((await store.read()).weatherApiKey, privateValues.weatherApiKey);
});
test('browser policy permits an origin referrer for public map tiles without exposing paths', async t => {
  const { request } = await setup(t);
  assert.equal((await request('/settings')).headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});
