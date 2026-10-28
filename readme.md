# Pi Weather Station

A weather dashboard for a Raspberry Pi touchscreen, a desktop browser, or a small home display. Keep a map and past radar frames beside current conditions, hourly and daily charts, a clock, and sunrise/sunset times.

This fork builds on [Eric Lewin's Pi Weather Station](https://github.com/elewin/pi-weather-station). The original layout and MIT attribution are retained.

[![Tests](https://github.com/SeanRiggs/pi-weather-station/actions/workflows/test.yml/badge.svg)](https://github.com/SeanRiggs/pi-weather-station/actions/workflows/test.yml)

## See it in action

Two views of version 3.1 running with live provider data and no provider accounts or API keys. These are captured examples, not a live weather feed.

### Lucena City, Philippines

Current conditions and forecast charts beside a local map and past-radar overlay.

![Pi Weather Station showing Lucena City, Philippines, with current conditions, hourly and five-day forecast charts, and a regional map](docs/images/lucena-city-weather.png)

### Seattle, Washington

A wider regional view makes the radar precipitation east of Seattle visible while keeping the selected location's conditions and forecasts alongside it.

![Pi Weather Station showing Seattle, Washington, with regional precipitation radar, current conditions, and forecast charts](docs/images/seattle-weather-radar.png)

Captured October 28, 2026 (UTC), at 800 × 480. Each dashboard clock uses the location's timezone, so the Seattle view shows the previous evening. Click either image to view it at full size.

Maps © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright); weather by [Open-Meteo](https://open-meteo.com/), radar by [RainViewer](https://www.rainviewer.com/), and sunrise/sunset by [Sunrise-Sunset](https://sunrise-sunset.org/).

## Start without provider accounts

Version 3.1 uses **Open-Meteo weather and OpenStreetMap** for a new installation. Choose your latitude/longitude in Settings or allow browser location access: no weather key, map token, or credit card is required. RainViewer past radar and Sunrise-Sunset also need no accounts. Location names are optional; without LocationIQ, the dashboard shows coordinates.

This default is intended for **personal, noncommercial home displays**, subject to each provider's terms and coverage. It needs Internet access. It is not an unlimited hosted service or an offline map package.

Already have Tomorrow.io or Mapbox keys? Existing settings retain those providers automatically. Use the provider dropdowns in Settings to switch; saved keys are retained, so switching back is straightforward. An explicitly selected Tomorrow.io/Mapbox provider requires its key/token. There is no silent provider fallback.

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
| Weather, default | [Open-Meteo](https://open-meteo.com/en/docs) | No key for [noncommercial use](https://open-meteo.com/en/terms). Model-derived conditions, 24-hour and five-day charts. |
| Weather, optional | [Tomorrow.io Timelines](https://docs.tomorrow.io/reference/timeline-overview) | A key with access to the requested fields and current/hourly/daily timelines. |
| Base map, default | [OpenStreetMap](https://www.openstreetmap.org/) | No key. Standard street map, visible attribution, normal browser tile caching; [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). |
| Base map, optional | [Mapbox](https://docs.mapbox.com/help/dive-deeper/access-tokens/) | A public `pk.` token authorized for the map styles/tiles. Never enter a secret `sk.` token. |
| Past radar overlay | [RainViewer](https://www.rainviewer.com/api/weather-maps-api.html) | No key; personal/educational use, subject to provider terms and coverage. |
| Location names | [LocationIQ](https://docs.locationiq.com/docs/reverse-geocoding) | Optional key. Coordinates are shown when omitted or unavailable. |
| Sunrise/sunset | [Sunrise-Sunset](https://sunrise-sunset.org/api) | No key. Browser needs access to this public API. |

If you choose an account-based provider, check its current plan, permissions, and quotas. An old ClimaCell key is not assumed to work with a Tomorrow.io account. Forecast field availability depends on the plan. The app requests metric values internally and converts them for display.

RainViewer's [2026 transition](https://www.rainviewer.com/api/transition-faq.html) removed future radar frames and other color schemes and limits native zoom to 7. Animation here is **past radar**, not a prediction. Provider outages or missing coverage do not mean there is no precipitation.

### Free-service expectations

Provider limits checked on October 28, 2026; they can change:

- **Open-Meteo:** free noncommercial API limits are below 10,000 calls/day, 5,000/hour, and 600/minute. The server fetches current/hourly/daily data together and shares a 10-minute cache per location. Personal home automation is expressly permitted; commercial deployments need a different arrangement (the paid Open-Meteo endpoint is not implemented here).
- **Tomorrow.io:** its published free limits are 500 calls/day, 25/hour, and 3/second. One fixed-location dashboard normally schedules around 192 calls/day before extra navigation/restarts/retries. Field permissions and forecast coverage still need checking against your account.
- **Mapbox:** this app uses Static Tiles, not GL JS map-load billing. Standard accounts currently include 200,000 tiles/month, with paid overages. No-card demo access has lower caps; standard access requires a payment method. Consult [pricing](https://www.mapbox.com/pricing) and [account access](https://docs.mapbox.com/accounts/guides/demo-access/).
- **OpenStreetMap:** public tiles are donation-supported and best-effort. Only visible tiles are requested, directly by the browser with normal cache headers and an origin referrer. No bulk downloads, offline packs, background prefetching, or proxy cache bypass. Switch to Mapbox if your deployment needs another tile service. Both light/dark dashboard themes use the same standard OSM street map.
- **LocationIQ:** optional, currently 5,000 requests/day with attribution and rate limits; [pricing](https://locationiq.com/pricing).

Open-Meteo's current conditions are model estimates, not a sensor installed at your house. The current rain chance comes from the current forecast hour. Its daily chart shows **mean temperature / maximum precipitation probability**, or **maximum wind / total precipitation** when clicked. Hourly precipitation is the amount over the preceding hour. Missing values produce an error instead of invented zeroes. Forecast times follow the display device's timezone; set it for your location.

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

On first run, choose your starting latitude/longitude in Settings. Leave the default Open-Meteo and OpenStreetMap providers selected for a no-account setup. You can grant browser location permission instead; manual coordinates are more reliable for a fixed display. Zero coordinates are supported. The old third-party IP-geolocation lookup is no longer used.

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

The browser updates current weather every 10 minutes and hourly/daily charts every hour. Tomorrow.io server caches use the same intervals per location. Open-Meteo shares one combined response for 10 minutes; radar metadata is cached for 10 minutes. Panning to a new location may create new provider calls. Caches and provider backoff are in memory and reset when the server restarts, so they are not a quota guarantee.

The server bounds provider JSON to 2 MiB and requests to 10 seconds; browser requests time out after 15 seconds. It does not expose raw provider errors, key-bearing URLs, or stack traces through the API. Missing keys, denied plans, or incomplete provider responses show an error rather than fabricated weather values. After a failed refresh, retained values are marked as previous data. Location-name failures fall back to coordinates; radar failures keep the base map with an unavailable notice.

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

The server tests use disposable settings files and simulated provider responses, plus a local HTTP timeout test. Browser tests run the built UI with fake provider data and tiles; they cover no-account setup/reload, provider switching with retained keys, first-run setup, zero coordinates, current weather/charts, radar URLs, key masking, save/reload, invalid settings, and a narrow viewport. They never use real account keys. Docker CI builds and checks startup, nonroot execution, and settings retention across container recreation on AMD64/ARM64, plus ARMv7 emulation with Node 22.

The UI keeps compatible React/Leaflet/chart component versions while updating the build tooling and locked dependencies. A broader framework redesign is separate from this refresh. Live no-key Open-Meteo responses were checked for Denver and Lucena. Private provider accounts, forecast accuracy, and physical Raspberry Pi touchscreen interaction still require checks on your installation.

Contributions are welcome: include reproducible steps and a test for changed behavior, use synthetic fixtures, and remove API keys/settings before sharing logs. See [CHANGELOG.md](CHANGELOG.md) and [UPGRADING.md](UPGRADING.md).

MIT licensed. Original copyright © 2020 Eric Lewin; see [LICENSE](LICENSE).
