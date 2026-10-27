# Changelog

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
