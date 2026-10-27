const { AppError } = require('./settingsCtrl');
// Keep provider semantics explicit: WMO codes differ from Tomorrow.io codes.
const CODES = {
  0: [1000, 'Clear'], 1: [1100, 'Mainly clear'], 2: [1101, 'Partly cloudy'], 3: [1001, 'Overcast'],
  45: [2000, 'Fog'], 48: [2000, 'Depositing rime fog'],
  51: [4000, 'Light drizzle'], 53: [4000, 'Drizzle'], 55: [4000, 'Dense drizzle'],
  56: [6000, 'Light freezing drizzle'], 57: [6000, 'Dense freezing drizzle'],
  61: [4200, 'Light rain'], 63: [4001, 'Rain'], 65: [4201, 'Heavy rain'],
  66: [6200, 'Light freezing rain'], 67: [6201, 'Heavy freezing rain'],
  71: [5100, 'Light snow'], 73: [5000, 'Snow'], 75: [5101, 'Heavy snow'], 77: [5001, 'Snow grains'],
  80: [4200, 'Light rain showers'], 81: [4001, 'Rain showers'], 82: [4201, 'Heavy rain showers'],
  85: [5100, 'Light snow showers'], 86: [5101, 'Heavy snow showers'],
  95: [8000, 'Thunderstorm'], 96: [8000, 'Thunderstorm with hail'], 97: [8000, 'Heavy thunderstorm'], 99: [8000, 'Thunderstorm with heavy hail'],
};
function openMeteoUrl(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: lat, longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,is_day',
    hourly: 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m',
    daily: 'temperature_2m_mean,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
    temperature_unit: 'celsius', wind_speed_unit: 'ms', precipitation_unit: 'mm',
    timezone: 'auto', timeformat: 'unixtime', forecast_days: '5',
  });
  return url;
}
function fail() { throw new AppError(502, 'Open-Meteo returned incomplete weather data.'); }
function number(value) { if (!Number.isFinite(value)) fail(); return value; }
function percent(value) { number(value); if (value < 0 || value > 100) fail(); return value; }
function nonnegative(value) { number(value); if (value < 0) fail(); return value; }
function timestamp(value) { number(value); if (value <= 0 || !Number.isFinite(new Date(value * 1000).getTime())) fail(); return new Date(value * 1000).toISOString(); }
function rows(data, fields) {
  if (!Array.isArray(data?.time) || !data.time.length || fields.some(f => !Array.isArray(data[f]) || data[f].length !== data.time.length)) fail();
  return data.time.map((time, i) => {
    if (i && time <= data.time[i - 1]) fail();
    return { startTime: timestamp(time), time, values: Object.fromEntries(fields.map(f => [f, number(data[f][i])])) };
  });
}
function normalizeOpenMeteo(data) {
  const c = data?.current; if (!c) fail();
  const startTime = timestamp(c.time);
  const hourRows = rows(data.hourly, ['temperature_2m', 'precipitation_probability', 'precipitation', 'wind_speed_10m']);
  // Include the current forecast hour, never the hours from earlier in the day.
  const currentHour = hourRows.find(r => r.time <= c.time && r.time + 3600 > c.time);
  if (!currentHour) fail();
  const hourly = hourRows.filter(r => r.time >= currentHour.time).slice(0, 24);
  const daily = rows(data.daily, ['temperature_2m_mean', 'precipitation_probability_max', 'precipitation_sum', 'wind_speed_10m_max']).slice(0, 5);
  if (hourly.length !== 24 || daily.length !== 5 || ![0, 1].includes(c.is_day)) fail();
  const code = CODES[number(c.weather_code)];
  const values = { temperature: number(c.temperature_2m), humidity: percent(c.relative_humidity_2m),
    windSpeed: nonnegative(c.wind_speed_10m), cloudCover: percent(c.cloud_cover),
    precipitationProbability: percent(currentHour.values.precipitation_probability),
    precipitationType: [71, 73, 75, 77, 85, 86].includes(c.weather_code) ? 2 : 0,
    weatherCode: code ? code[0] : -1, conditionText: code ? code[1] : 'Conditions unavailable', isDay: c.is_day === 1 };
  const wrap = (timestep, intervals) => ({ provider: 'open-meteo', data: { timelines: [{ timestep, intervals }] } });
  return {
    current: wrap('current', [{ startTime, values }]),
    hourly: wrap('1h', hourly.map(r => ({ startTime: r.startTime, values: {
      temperature: r.values.temperature_2m, precipitationProbability: percent(r.values.precipitation_probability),
      precipitationIntensity: nonnegative(r.values.precipitation), windSpeed: nonnegative(r.values.wind_speed_10m) } }))),
    daily: wrap('1d', daily.map(r => ({ startTime: r.startTime, values: {
      temperature: r.values.temperature_2m_mean, precipitationProbability: percent(r.values.precipitation_probability_max),
      precipitationAmount: nonnegative(r.values.precipitation_sum), windSpeed: nonnegative(r.values.wind_speed_10m_max) } }))),
  };
}
module.exports = { openMeteoUrl, normalizeOpenMeteo };
