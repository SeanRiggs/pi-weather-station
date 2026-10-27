const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const MASK = '[configured]';
const KEYS = ['weatherApiKey', 'mapApiKey', 'reverseGeoApiKey', 'startingLat', 'startingLon', 'weatherProvider', 'mapProvider'];
class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function validate(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(k => !KEYS.includes(k))) throw new AppError(400, 'Unknown settings fields or invalid settings object.');
  const result = {};
  for (const [key, raw] of Object.entries(input)) {
    if (typeof raw !== 'string' && typeof raw !== 'number' && raw !== null) throw new AppError(400, 'Invalid setting value.');
    const value = raw == null ? '' : String(raw).trim();
    if (value.length > 512 || /[\x00-\x1f\x7f]/.test(value)) throw new AppError(400, 'Invalid setting value.');
    if (key === 'weatherProvider' && !['', 'open-meteo', 'tomorrow'].includes(value)) throw new AppError(400, 'Choose Open-Meteo or Tomorrow.io.');
    if (key === 'mapProvider' && !['', 'osm', 'mapbox'].includes(value)) throw new AppError(400, 'Choose OpenStreetMap or Mapbox.');
    if (key === 'mapApiKey' && value && !value.startsWith('pk.')) throw new AppError(400, 'Mapbox needs a public pk. token, not a secret token.');
    if (key.startsWith('starting') && value !== '' && (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > (key === 'startingLat' ? 90 : 180))) throw new AppError(400, 'Coordinates are outside the allowed range.');
    result[key] = value;
  }
  return result;
}
function publicSettings(settings) {
  const safe = Object.fromEntries(KEYS.map(k => [k, settings[k] || '']));
  for (const key of ['weatherApiKey', 'reverseGeoApiKey']) safe[key] = settings[key] ? MASK : '';
  safe.weatherProvider = settings.weatherProvider || (settings.weatherApiKey ? 'tomorrow' : 'open-meteo');
  safe.mapProvider = settings.mapProvider || (settings.mapApiKey ? 'mapbox' : 'osm');
  return safe;
}
class SettingsStore {
  constructor(filename) { this.filename = filename; this.pending = Promise.resolve(); }
  async read() {
    try { return validate(JSON.parse(await fs.readFile(this.filename, 'utf8'))); }
    catch (error) {
      if (error.code === 'ENOENT') return {};
      throw new AppError(500, 'Settings cannot be read. Restore a valid settings file before saving.');
    }
  }
  update(input, operation = 'merge') {
    const task = this.pending.then(async () => {
      const values = validate(input);
      const old = await this.read(); // Corrupt files are never silently replaced.
      if (operation === 'create' && await fs.stat(this.filename).catch(() => null)) throw new AppError(409, 'Settings already exist.');
      const next = { ...old, ...values };
      for (const key of ['weatherApiKey', 'reverseGeoApiKey']) {
        if (values[key] === MASK) {
          if (!old[key]) throw new AppError(400, 'No saved key exists for that placeholder.');
          next[key] = old[key];
        }
      }
      await fs.mkdir(path.dirname(this.filename), { recursive: true, mode: 0o700 });
      const temp = this.filename + '.' + randomUUID() + '.tmp';
      try {
        const file = await fs.open(temp, 'wx', 0o600);
        try { await file.writeFile(JSON.stringify(next, null, 2) + '\n'); await file.sync(); } finally { await file.close(); }
        await fs.rename(temp, this.filename);
      } finally { await fs.rm(temp, { force: true }); }
      return publicSettings(next);
    });
    this.pending = task.catch(() => {});
    return task;
  }
}
module.exports = { SettingsStore, publicSettings, validate, AppError, MASK };
