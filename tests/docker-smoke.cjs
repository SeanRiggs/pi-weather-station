const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8080';
(async () => {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    if (await fetch(base + '/healthz').then(r => r.ok).catch(() => false)) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'container did not become ready');
  if (process.argv[2] === 'write') {
    const r = await fetch(base + '/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weatherApiKey: 'fixture-key', startingLat: '0', startingLon: '0' }) });
    assert.equal(r.status, 200);
  }
  const data = await (await fetch(base + '/settings')).json();
  assert.equal(data.weatherApiKey, '[configured]'); assert.equal(data.startingLat, '0');
  const html = await (await fetch(base)).text();
  assert.match(html, /bundle\.[a-f0-9]+\.js/);
  assert.equal((await fetch(base + '/settings.json')).status, 404);
  console.log('Container smoke passed: ready, built UI, masked settings, persistent zero coordinates.');
})().catch(e => { console.error(e); process.exitCode = 1; });
