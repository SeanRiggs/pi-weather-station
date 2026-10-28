# Settings, access, and troubleshooting

[Back to the README](../readme.md) · [Docker guide](../Docker%20Image/Docker-ReadMe.md) · [Upgrade guide](../UPGRADING.md)

## Settings and storage

Settings are saved to `settings.json` at the repository root by default. You may copy `settings.example.json` there and edit it before starting. Keep it private; it is ignored by Git. The server creates new settings files with mode `0600`.

After saving, private key inputs show `[configured]`. Leave that placeholder unchanged to keep a key, enter a new key to change it, or clear the field to remove it. Save errors appear in Settings instead of silently closing the panel.

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

## Troubleshooting

| What you see | What to check |
| --- | --- |
| No weather on first start | Open the gear icon, enter latitude and longitude, keep Open-Meteo and OpenStreetMap selected, and save. Verify Internet access. |
| Coordinates instead of a city name | This is expected without the optional LocationIQ key. Weather still works. |
| Browser location permission fails | Enter fixed coordinates in Settings. Location permission depends on the browser and connection type. |
| Weather works, but radar is empty | Check for a radar-unavailable notice, provider coverage, and the selected region. Past radar is not a forecast; an empty overlay does not establish dry weather. |
| Base map unavailable | Check connectivity and provider selection. Following a tile failure, try moving or zooming the map to load new tiles; failed tiles are not guaranteed to retry automatically. |
| Previous-data notice | A refresh failed. Retained readings remain visible; weather retries on its normal schedule. Avoid repeated reloads during provider rate limiting. |
| `Host is not allowed` or a password-related startup error | Check the exact hostname/IP in `ALLOWED_HOSTS` and set `DASHBOARD_PASSWORD` for additional hosts. Also review binding and private access above. |
| Cannot open the dashboard from a phone or another computer | The default URL works on the host running the app. Remote access requires deliberate configuration; see Configuration above. |
| Settings will not save | Read the visible save error. Check settings-file ownership, its writable parent directory, supported fields, and valid coordinates. Back up a malformed file before repairing it. |
| Old interface after upgrading Docker | Follow the upgrade guide. A legacy volume mounted over `/app` can hide the new code. |
| Wrong clock or forecast times | Set the display device's timezone for the chosen location. Selecting coordinates does not change the browser timezone. |

### Check a Docker installation

Run these from the repository directory:

```sh
docker compose ps
docker compose logs --tail=50 weather-station
```

Open **http://127.0.0.1:8080/healthz** on the host to check the server's readiness and version. A healthy server does not prove that external weather, radar, or map services are reachable.

Review logs before sharing them and remove passwords, tokens, private settings, and precise home coordinates. For a bug report, include the installation method, architecture, version, browser, steps to reproduce, expected behavior, and actual behavior. See [Contributing](../CONTRIBUTING.md).
