# Pi Weather Station

A weather dashboard for a Raspberry Pi touchscreen, a desktop browser, or a small home display. Keep a map and past radar frames beside current conditions, hourly and daily charts, a clock, and sunrise/sunset times.

This fork builds on [Eric Lewin's Pi Weather Station](https://github.com/elewin/pi-weather-station). The original layout and MIT attribution are retained.

[![Tests](https://github.com/SeanRiggs/pi-weather-station/actions/workflows/test.yml/badge.svg)](https://github.com/SeanRiggs/pi-weather-station/actions/workflows/test.yml)

## Version 3 refresh

- Weather requests now go through the server to Tomorrow.io's current v4 Timelines endpoint; the old ClimaCell hostname is no longer used by the dashboard.
- Weather and optional LocationIQ keys are stored on the server and returned as `[configured]`, rather than exposed through settings reads or browser provider URLs. The Mapbox **public** token still goes to the browser, as required for map tiles.
- RainViewer uses the current weather-maps response, past frames, Universal Blue, and native radar zoom 7 with overzoom at closer map views.
- Downloads have timeouts and response-size limits. Server caches share repeat requests; concurrent weather requests are deduplicated, and provider 429 responses trigger backoff.
- Settings writes are validated, serialized, and replaced atomically; malformed existing settings are preserved for recovery.
- The server defaults to localhost, rejects unexpected Host/cross-origin requests, and supports an optional dashboard password. Additional allowed hostnames require a password.
- Docker builds from this repository, runs as a nonroot user, and persists only `/data`, keeping application upgrades separate from your settings.
- The original 800×480 layout remains available, with a stacked layout on smaller screens and scrollable settings.

## Providers and setup requirements

| Feature | Provider | Configuration |
| --- | --- | --- |
| Current conditions and charts | [Tomorrow.io Timelines](https://docs.tomorrow.io/reference/timeline-overview) | A key with access to the requested fields and current/hourly/daily timelines. |
| Base map | [Mapbox](https://docs.mapbox.com/help/dive-deeper/access-tokens/) | A public `pk.` token authorized for the map styles/tiles. Never enter a secret `sk.` token. |
| Past radar overlay | [RainViewer](https://www.rainviewer.com/api/weather-maps-api.html) | No key; personal/educational use, subject to provider terms and coverage. |
| Location names | [LocationIQ](https://docs.locationiq.com/docs/reverse-geocoding) | Optional key. Coordinates are shown when omitted or unavailable. |
| Sunrise/sunset | [Sunrise-Sunset](https://sunrise-sunset.org/api) | No key. Browser needs access to this public API. |

Check your account's current plan, permissions, and quotas. An old ClimaCell key is not assumed to work with a Tomorrow.io account. Forecast field availability depends on the plan. The app requests metric values internally and converts them for display.

RainViewer's [2026 transition](https://www.rainviewer.com/api/transition-faq.html) removed future radar frames and other color schemes and limits native zoom to 7. Animation here is **past radar**, not a prediction. Provider outages or missing coverage do not mean there is no precipitation.

## Run from source

Use a maintained **Node.js 24** release; Node 22 is also covered by server tests. Use a current Chromium-based browser on the display.

```sh
git clone https://github.com/SeanRiggs/pi-weather-station.git
cd pi-weather-station
npm ci
npm --prefix client ci
npm run build
npm start
```

Open **http://127.0.0.1:8080**. Use browser full-screen/kiosk mode if desired. The server does not try to launch a desktop browser, which also makes it suitable for headless hosts.

On first run, open Settings and enter a Tomorrow.io key, a Mapbox public token, and your starting latitude/longitude. You can grant browser location permission instead; manual coordinates are more reliable for a fixed display. Zero coordinates are supported. The old third-party IP-geolocation lookup is no longer used.

Settings are saved to `settings.json` at the repository root by default. You may copy `settings.example.json` there and edit it before starting. Keep it private; it is ignored by Git. The server creates new settings files with mode `0600`.

After saving, private key inputs show `[configured]`. Leave that placeholder unchanged to keep a key, enter a new key to change it, or clear the field to remove it. Save errors appear in Settings instead of silently closing the panel.

### Docker

For a fresh installation with Docker Compose v2:

```sh
docker compose up -d --build
```

Open **http://127.0.0.1:8080** on the Docker host. The root Compose file builds `pi-weather-station:local`, publishes only on loopback, and stores settings in the named `weather-data` volume at `/data/settings.json`.

**This source-build workflow does not update Docker Hub.** Existing `seanriggs/pi-weather-station:latest`, `:arm64`, or `:armv7-armhf` tags must not be assumed to contain version 3. A registry release is a separate publishing step. See the [Docker guide](Docker%20Image/Docker-ReadMe.md) for architectures and legacy Compose paths.

**Existing Docker users:** read [UPGRADING.md](UPGRADING.md) before changing containers. The old `appdata:/app` mount contains application files as well as settings; reusing it can retain obsolete code. Export your settings and keep the old volume until migration is verified. Do not use `docker compose down -v` during an upgrade.

## Configuration

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `HOST` | `127.0.0.1` from source; `0.0.0.0` in Docker | Server bind address. Docker's host publishing rule still controls access. |
| `PORT` | `8080` | Listening port. |
| `SETTINGS_FILE` | Repository `settings.json`; `/data/settings.json` in Docker | Private settings file. Its directory must be writable by the server account. |
| `DASHBOARD_PASSWORD` | Empty | When set, protect the app and settings with HTTP Basic authentication, username `weather`. |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Accepted request hostnames/IPs, without schemes or ports. Adding LAN addresses/names requires `DASHBOARD_PASSWORD`. |
| `NODE_VERSION` | `24` | Compose build argument; use `22` for an ARMv7 source build. |

For access from another machine, configure the bind address, the exact allowed hostname/IP, and a strong dashboard password. In Docker, also explicitly change the loopback-only port binding. Basic authentication needs HTTPS through a properly configured reverse proxy or a trusted private tunnel to protect the password in transit. Keep this a private dashboard; the project is not an Internet-facing multiuser service. Proxy Host handling must match `ALLOWED_HOSTS`.

Private settings remain plaintext on the server's disk, readable by its account and administrators. Anyone authorized to the dashboard can change its provider settings. The password protects settings as well as the dashboard; `/healthz` exposes only readiness/version. A public Mapbox token is intentionally visible to viewers—restrict its scopes and allowed URLs appropriately in Mapbox.

## Refreshes and failure behavior

The browser updates current weather every 10 minutes and hourly/daily charts every hour. Server caches use the same intervals per location; radar metadata is cached for 10 minutes. Panning to a new location may create new provider calls. Caches and provider backoff are in memory and reset when the server restarts, so they are not a quota guarantee.

The server bounds provider JSON to 2 MiB and requests to 10 seconds; browser requests time out after 15 seconds. It does not expose raw provider errors, key-bearing URLs, or stack traces through the API. Missing keys, denied plans, or incomplete provider responses show an error rather than fabricated weather values. Location-name failures fall back to coordinates; radar failures keep the base map with an unavailable notice.

Displayed clock/forecast labels use the browser's timezone; set the display device's timezone to match the location for a fixed kiosk. The dashboard does not provide severe-weather alerts or safety-critical forecasts.

## Development and verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm audit --omit=dev
npm --prefix client audit --omit=dev
```

The server tests use disposable settings files and simulated provider responses, plus a local HTTP timeout test. Browser tests run the built UI with fake provider data and tiles; they cover first-run setup, zero coordinates, current weather/charts, radar URLs, key masking, save/reload, invalid settings, and a narrow viewport. They never use real account keys. Docker CI builds and checks startup, nonroot execution, and settings retention across container recreation on AMD64/ARM64, plus ARMv7 emulation with Node 22.

The UI keeps compatible React/Leaflet/chart component versions while updating the build tooling and locked dependencies. A broader framework redesign is separate from this refresh. Provider accounts, real map imagery, forecast accuracy, and physical Raspberry Pi touchscreen interaction still require checks on your installation.

Contributions are welcome: include reproducible steps and a test for changed behavior, use synthetic fixtures, and remove API keys/settings before sharing logs. See [CHANGELOG.md](CHANGELOG.md) and [UPGRADING.md](UPGRADING.md).

MIT licensed. Original copyright © 2020 Eric Lewin; see [LICENSE](LICENSE).
