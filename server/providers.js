const { openMeteoUrl, normalizeOpenMeteo } = require('./openMeteo');
const { AppError } = require('./settingsCtrl');
const FIELDS = ['temperature', 'humidity', 'windSpeed', 'precipitationIntensity', 'precipitationType', 'precipitationProbability', 'cloudCover', 'weatherCode'];
function coordinates(query) {
  if (typeof query.lat !== 'string' || typeof query.lon !== 'string' || !query.lat.trim() || !query.lon.trim()) throw new AppError(400, 'Latitude and longitude are required.');
  const lat = Number(query.lat), lon = Number(query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new AppError(400, 'Invalid coordinates.');
  return { lat, lon };
}
function radarFrames(data) {
  if (data?.host !== 'https://tilecache.rainviewer.com' || !Array.isArray(data?.radar?.past)) throw new AppError(502, 'Radar data is unavailable.');
  const frames = data.radar.past.filter(f => Number.isSafeInteger(f.time) && f.time > 0 && /^\/v2\/radar\/[A-Za-z0-9_-]{1,128}$/.test(f.path)).slice(-13);
  if (!frames.length) throw new AppError(502, 'No radar frames are available.');
  return frames.map(f => ({ time: f.time, url: `${data.host}${f.path}` }));
}
class Providers {
  constructor(store, { fetchImpl = fetch, now = Date.now, timeout = 10000 } = {}) {
    this.store = store; this.fetch = fetchImpl; this.now = now; this.timeout = timeout;
    this.cache = new Map(); this.inflight = new Map(); this.blocked = new Map();
  }
  clear() { this.cache.clear(); }
  async json(url, options = {}) {
    let response;
    try {
      response = await this.fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(this.timeout) });
      if (response.status === 429) {
        const raw = response.headers.get('retry-after');
        const seconds = /^\d+$/.test(raw || '') ? Number(raw) : (Date.parse(raw) - this.now()) / 1000;
        this.blocked.set(new URL(url).hostname, this.now() + Math.max(60000, Math.min(Number.isFinite(seconds) ? seconds * 1000 : 60000, 86400000)));
        throw new AppError(429, 'Provider rate limit reached. Wait before requesting another update.');
      }
      if (!response.ok) throw new AppError(response.status === 401 || response.status === 403 ? 424 : 502, 'Provider rejected the request. Check the API key and its plan permissions.');
      const reader = response.body.getReader();
      const chunks = []; let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          length += value.length;
          if (length > 2 * 1024 * 1024) throw new AppError(502, 'Provider response exceeded the size limit.');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'Provider request failed, timed out, or returned invalid data.');
    }
  }
  async cached(key, host, ttl, loader) {
    if ((this.blocked.get(host) || 0) > this.now()) throw new AppError(429, 'Provider is cooling down after a rate limit.');
    const hit = this.cache.get(key);
    if (hit && hit.until > this.now()) return hit.data;
    if (this.inflight.has(key)) return this.inflight.get(key);
    const work = loader().then(data => {
      if (this.cache.size >= 64) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, { data, until: this.now() + ttl }); return data;
    }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, work); return work;
  }
  async weather(query) {
    const { lat, lon } = coordinates(query);
    const kind = query.kind;
    if (!['current', 'hourly', 'daily'].includes(kind)) throw new AppError(400, 'Invalid forecast kind.');
    const settings = await this.store.read();
    const provider = settings.weatherProvider || (settings.weatherApiKey ? 'tomorrow' : 'open-meteo');
    if (provider === 'open-meteo') {
      const data = await this.cached(JSON.stringify(['open-meteo', lat, lon]), 'api.open-meteo.com', 600000, async () =>
        normalizeOpenMeteo(await this.json(openMeteoUrl(lat, lon))));
      return data[kind];
    }
    if (!settings.weatherApiKey) throw new AppError(422, 'Add your Tomorrow.io weather API key in Settings.');
    const fields = kind === 'current' ? FIELDS : ['temperature', 'precipitationProbability', 'precipitationIntensity', 'windSpeed'];
    const step = { current: 'current', hourly: '1h', daily: '1d' }[kind];
    const host = 'api.tomorrow.io';
    // Key changes cannot reuse a previous key's cached result.
    const key = JSON.stringify([settings.weatherApiKey, lat, lon, kind]);
    return this.cached(key, host, kind === 'current' ? 600000 : 3600000, async () => {
      const body = { location: [lat, lon], fields, units: 'metric', timesteps: [step], timezone: 'auto', startTime: 'now' };
      if (kind !== 'current') body.endTime = kind === 'hourly' ? 'nowPlus23h' : 'nowPlus5d';
      const result = await this.json(`https://${host}/v4/timelines?apikey=${encodeURIComponent(settings.weatherApiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const timeline = result?.data?.timelines?.find(t => t.timestep === step);
      const intervals = timeline?.intervals?.slice(0, kind === 'current' ? 1 : kind === 'hourly' ? 24 : 5);
      if (!intervals?.length || intervals.some(i => !Number.isFinite(Date.parse(i.startTime)) || fields.some(f => !Number.isFinite(i.values?.[f])))) throw new AppError(502, 'Provider returned incomplete weather data.');
      return { provider: 'tomorrow', data: { timelines: [{ timestep: step, intervals: intervals.map(i => ({ startTime: i.startTime, values: Object.fromEntries(fields.map(f => [f, i.values[f]])) })) }] } };
    });
  }
  async radar() {
    return this.cached('radar', 'api.rainviewer.com', 600000, async () => radarFrames(await this.json('https://api.rainviewer.com/public/weather-maps.json')));
  }
  async reverse(query) {
    const { lat, lon } = coordinates(query);
    const settings = await this.store.read();
    if (!settings.reverseGeoApiKey) throw new AppError(422, 'Optional LocationIQ key is not configured.');
    return this.cached(JSON.stringify(['geo', settings.reverseGeoApiKey, lat, lon]), 'us1.locationiq.com', 3600000, async () => {
      const url = new URL('https://us1.locationiq.com/v1/reverse');
      url.search = new URLSearchParams({ key: settings.reverseGeoApiKey, lat, lon, format: 'json' });
      const result = await this.json(url);
      if (!result.address || typeof result.address !== 'object') throw new AppError(502, 'Location name is unavailable.');
      const address = {};
      for (const key of ['city', 'town', 'village', 'county', 'state', 'country', 'country_code', 'region']) if (typeof result.address[key] === 'string') address[key] = result.address[key];
      return { address };
    });
  }
}
module.exports = { Providers, coordinates, radarFrames };
