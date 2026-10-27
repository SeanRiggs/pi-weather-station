function response(url, init) {
  const host = new URL(url).hostname;
  if (host === 'api.tomorrow.io') {
    const step = JSON.parse(init.body).timesteps[0];
    return { debugSecret: 'private-weather-key', data: { timelines: [{ timestep: step, intervals: Array.from({ length: step === 'current' ? 1 : step === '1h' ? 24 : 5 }, (_, i) => ({ startTime: new Date(Date.UTC(2026, 9, 27) + i * (step === '1d' ? 86400000 : 3600000)).toISOString(), values: { temperature: 20, humidity: 55, windSpeed: 3, precipitationIntensity: 0, precipitationType: 0, precipitationProbability: 10, cloudCover: 25, weatherCode: 1000 } })) }] } };
  }
  if (host === 'api.rainviewer.com') return { host: 'https://tilecache.rainviewer.com', radar: { past: [{ time: 1609401600, path: '/v2/radar/266d4e9ea76f' }] } };
  if (host === 'us1.locationiq.com') return { address: { city: 'Fixture City', country: 'Test', debugSecret: 'private-location-key' } };
  throw new Error('Unexpected upstream fixture request');
}
module.exports = { response };
