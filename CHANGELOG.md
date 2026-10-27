# Changelog

## 3.1.0 — 2026-10-28

- Add a no-account default: Open-Meteo weather and OpenStreetMap base maps, alongside public past radar and sunrise/sunset.
- Preserve existing Tomorrow.io/Mapbox selections and saved credentials; add explicit provider choices and simplify Settings around location first.
- Share one validated Open-Meteo response across current/hourly/daily views with caching, deduplication, and rate-limit backoff.
- Convert WMO conditions and metric units deliberately; label model estimates and daily aggregates, reject incomplete data, and preserve unknown conditions.
- Retain attribution, browser tile caching and origin referrers for OSM; request only visible tiles and display base-map failure feedback.
- Document provider free tiers, noncommercial limits, map behavior, and migration. Add no-account and provider-switching regressions.
- Verify live Open-Meteo data for Denver and Lucena. Docker Hub publication and physical Pi deployment remain separate.


## 3.0.0 — 2026-10-27

- Move Tomorrow.io and optional LocationIQ requests to validated, bounded server endpoints; mask private keys in settings responses.
- Update radar metadata, native zoom, and Universal Blue handling for RainViewer's current public API.
- Add atomic serialized settings writes, optional dashboard authentication, Host/origin protection, caching, request deduplication, and provider backoff.
- Remove the obsolete external IP-geolocation lookup and automatic desktop browser launch.
- Modernize Node/build dependencies, build the client from source, and bundle Leaflet assets.
- Improve small-screen/settings behavior, zero coordinates, save feedback, and interval cleanup while retaining the original dashboard components.
- Add nonroot Docker source builds, data-only persistence, migration guidance, and AMD64/ARM64/ARMv7 CI checks.
- Add server and browser regression tests using synthetic provider responses; do not claim live account or physical Pi validation.
- Keep original MIT attribution. Existing Docker Hub tags are not republished by this refresh.
