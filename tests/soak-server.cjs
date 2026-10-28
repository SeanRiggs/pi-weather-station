// Isolated test worker. Never exposes failure controls through the HTTP app.
const { createApp } = require('../server');
const { Providers } = require('../server/providers');
const { SettingsStore } = require('../server/settingsCtrl');
const fixture = require('./fixtures.cjs');
let clock = null, weatherMode = 'ok', radarMode = 'ok';
const counters = {};
const store = new SettingsStore(process.env.SOAK_SETTINGS_FILE);
const now = () => clock === null ? Date.now() : clock;
function data(url, init) {
  const value = fixture.response(url, init);
  if (new URL(url).hostname === 'api.open-meteo.com') {
    const shift = Math.floor(now() / 3600000) * 3600 - value.current.time + 900;
    value.current.time += shift;
    value.hourly.time = value.hourly.time.map(t => t + shift);
    value.daily.time = value.daily.time.map(t => t + shift);
  }
  if (new URL(url).hostname === 'api.rainviewer.com') {
    const t = Math.floor(now() / 600000) * 600;
    value.radar.past = [t - 1200, t - 600, t].map(time => ({ time, path: '/v2/radar/fixture_' + time }));
  }
  return value;
}
const providers = new Providers(store, { now, timeout: 1500, fetchImpl: async (url, init) => {
  const host = new URL(url).hostname;
  counters[host] = (counters[host] || 0) + 1;
  const mode = host === 'api.open-meteo.com' ? weatherMode : host === 'api.rainviewer.com' ? radarMode : 'ok';
  if (mode === '503') return new Response('fixture outage', { status: 503 });
  if (mode === '429') return new Response('', { status: 429, headers: { 'Retry-After': '120' } });
  if (mode === 'timeout') return new Promise((_resolve, reject) => {
    if (init.signal.aborted) return reject(init.signal.reason);
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  });
  const result = data(url, init);
  if (mode === 'malformed') result.current.temperature_2m = null;
  return new Response(JSON.stringify(result));
} });
const server = createApp({ store, providers }).listen(Number(process.env.SOAK_PORT || 0), '127.0.0.1', () => {
  process.send({ ready: true, port: server.address().port });
});
process.on('message', async message => {
  try {
    if (Object.hasOwn(message, 'clock')) clock = message.clock;
    if (message.weatherMode) weatherMode = message.weatherMode;
    if (message.radarMode) radarMode = message.radarMode;
    if (message.clear) providers.clear();
    process.send({ id: message.id, metrics: { counters, memory: process.memoryUsage(), cacheEntries: providers.cache.size, inflight: providers.inflight.size, blocked: providers.blocked.size, weatherMode, radarMode } });
  } catch (e) { process.send({ id: message.id, error: e.message }); }
});
process.on('SIGTERM', () => { server.closeAllConnections(); server.close(() => process.exit(0)); });
