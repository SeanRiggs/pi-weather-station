function response(url, init) {
  const host = new URL(url).hostname;
  if (host === 'api.open-meteo.com') return openMeteo();
  if (host === 'api.tomorrow.io') {
    const step = JSON.parse(init.body).timesteps[0];
    return { debugSecret: 'private-weather-key', data: { timelines: [{ timestep: step, intervals: Array.from({ length: step === 'current' ? 1 : step === '1h' ? 24 : 5 }, (_, i) => ({ startTime: new Date(Date.UTC(2026, 9, 27) + i * (step === '1d' ? 86400000 : 3600000)).toISOString(), values: { temperature: 20, humidity: 55, windSpeed: 3, precipitationIntensity: 0, precipitationType: 0, precipitationProbability: 10, cloudCover: 25, weatherCode: 1000 } })) }] } };
  }
  if (host === 'api.rainviewer.com') return { host: 'https://tilecache.rainviewer.com', radar: { past: [{ time: 1609401600, path: '/v2/radar/266d4e9ea76f' }] } };
  if (host === 'us1.locationiq.com') return { address: { city: 'Fixture City', country: 'Test', debugSecret: 'private-location-key' } };
  throw new Error('Unexpected upstream fixture request');
}
function openMeteo() {
  const time = Date.UTC(2026, 9, 28, 12) / 1000;
  return {
    current: { time: time + 900, temperature_2m: 20, relative_humidity_2m: 55, wind_speed_10m: 3, cloud_cover: 25, weather_code: 0, is_day: 1 },
    hourly: { time: Array.from({ length: 120 }, (_, i) => time - 43200 + i * 3600), temperature_2m: Array(120).fill(20), precipitation_probability: Array(120).fill(10), precipitation: Array(120).fill(1.5), wind_speed_10m: Array(120).fill(3) },
    daily: { time: Array.from({ length: 5 }, (_, i) => time - 43200 + i * 86400), temperature_2m_mean: Array(5).fill(18), precipitation_probability_max: Array(5).fill(30), precipitation_sum: Array(5).fill(12), wind_speed_10m_max: Array(5).fill(5) },
  };
}
module.exports = { response, openMeteo };
