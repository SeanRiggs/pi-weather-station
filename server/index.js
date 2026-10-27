const express = require('express');
const path = require('node:path');
const { timingSafeEqual } = require('node:crypto');
const { SettingsStore, publicSettings, AppError } = require('./settingsCtrl');
const { Providers } = require('./providers');
function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  const store = options.store || new SettingsStore(options.settingsFile || process.env.SETTINGS_FILE || path.join(__dirname, '../settings.json'));
  const providers = options.providers || new Providers(store, options.providerOptions);
  const password = options.password ?? process.env.DASHBOARD_PASSWORD ?? '';
  const allowed = options.allowedHosts || (process.env.ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]').split(',').map(s => s.trim());
  if (allowed.some(h => !['localhost', '127.0.0.1', '[::1]'].includes(h)) && !password) throw new Error('Set DASHBOARD_PASSWORD before allowing additional hostnames or LAN addresses.');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' });
    let host;
    try { host = new URL(`http://${req.headers.host}`).hostname; } catch { return res.sendStatus(400); }
    if (!allowed.includes(host)) return res.status(403).json({ message: 'Host is not allowed.' });
    if (req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin)) return res.status(403).json({ message: 'Cross-origin requests are not allowed.' });
    if (req.path === '/healthz' && req.method === 'GET') return res.json({ status: 'ok', version: require('../package.json').version });
    if (password) {
      const supplied = req.headers.authorization || '';
      const expected = 'Basic ' + Buffer.from('weather:' + password).toString('base64');
      const a = Buffer.from(supplied), b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return res.set('WWW-Authenticate', 'Basic realm="Pi Weather Station", charset="UTF-8"').sendStatus(401);
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ message: 'Use an application/json request body.' });
    next();
  });
  app.use(express.json({ limit: '8kb', strict: true }));
  app.get('/settings', async (_req, res) => res.json(publicSettings(await store.read())));
  for (const method of ['post', 'put']) app[method]('/settings', async (req, res) => {
    const settings = await store.update(req.body, method === 'post' ? 'create' : 'merge');
    providers.clear(); res.status(method === 'post' ? 201 : 200).json(settings);
  });
  app.patch('/setting', async (req, res) => {
    if (typeof req.body?.key !== 'string') throw new AppError(400, 'A setting key is required.');
    const settings = await store.update({ [req.body.key]: req.body.val }); providers.clear(); res.json(settings);
  });
  app.delete('/setting', async (req, res) => {
    if (typeof req.query.key !== 'string') throw new AppError(400, 'A setting key is required.');
    const settings = await store.update({ [req.query.key]: '' }); providers.clear(); res.json(settings);
  });
  app.get('/api/weather', async (req, res) => res.json(await providers.weather(req.query)));
  app.get('/api/radar', async (_req, res) => res.json(await providers.radar()));
  app.get('/api/reverse', async (req, res) => res.json(await providers.reverse(req.query)));
  app.get('/geolocation', async (_req, res) => {
    const settings = await store.read();
    if (settings.startingLat === undefined || settings.startingLat === '' || settings.startingLon === undefined || settings.startingLon === '') throw new AppError(422, 'Choose your latitude and longitude in Settings, or allow browser location access.');
    res.json({ latitude: Number(settings.startingLat), longitude: Number(settings.startingLon) });
  });
  app.use(express.static(options.distDir || path.join(__dirname, '../client/dist'), { dotfiles: 'deny', index: 'index.html' }));
  app.use((_req, res) => res.status(404).json({ message: 'Not found.' }));
  app.use((error, _req, res, _next) => {
    const status = error instanceof AppError ? error.status : error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    // Never serialize fetch/axios errors, URLs, settings, or stack traces to clients.
    res.status(status).json({ message: error instanceof AppError ? error.message : status === 400 ? 'Invalid JSON body.' : status === 413 ? 'Request body is too large.' : 'Server operation failed. Check settings storage and permissions.' });
  });
  return app;
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  const server = createApp().listen(port, host, () => console.log(`Pi Weather Station listening on ${host}:${port}`));
  server.on('error', () => { console.error('Cannot start server; check HOST, PORT, and permissions.'); process.exitCode = 1; });
  for (const event of ['SIGINT', 'SIGTERM']) process.on(event, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });
}
module.exports = { createApp };
