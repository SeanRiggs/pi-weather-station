# Verification record

[Back to the README](../readme.md) · [Run development checks](../CONTRIBUTING.md#verify-a-change)

## Five-hour stability run — October 28, 2026

[GitHub Actions run 40627093673](https://github.com/SeanRiggs/pi-weather-station/actions/runs/40627093673) completed successfully on its first attempt. Both job logs and both JSON reports were reviewed.

- Application baseline: `474ecc720479f852c5bae76a35fe01cdac536b3d`.
- Tested commit, adding the isolated test harness: `edf642f62f2b236b6558e357d4e4bb9bae38af35`.
- Environment: GitHub-hosted Ubuntu 24.04, Node 24, headless Chrome; 800 × 480 viewport.
- Real-time soak: 03:32:34–08:32:34 UTC, October 28, 2026 (five hours).
- Full workflow including setup and preflight: approximately 5 hours, 2 minutes.
- Reports: `accelerated-recovery-report` and `five-hour-soak-report`, each containing `report.json` and a final screenshot. GitHub artifact retention for this run ends November 4, 2026; this summary preserves the key results.

### Results

| Area | Observed result |
| --- | --- |
| Server suite | 36 passed; zero failed. |
| Accelerated recovery | Weather HTTP 503/429, timeouts, and malformed data retained previous charts, showed failure feedback, and recovered on scheduled refresh. Rate-limit cooldown prevented an immediate extra upstream request. |
| Radar and map recovery | Radar metadata recovered automatically. Base-map tiles recovered after navigating to new tiles; this did not test automatic retry of failed tiles. |
| Clock advance | A 24-hour simulated clock jump left refresh timers and weather panels functional. |
| Five-hour browser requests | 31 current-weather, 6 hourly, and 6 daily requests, including initial loads and failed attempts. |
| Injected weather outage | HTTP 503 from minutes 25–42; previous-data notice and subsequent recovery checks passed. |
| Injected radar outage | HTTP 503 from minutes 60–77; unavailable notice and subsequent recovery checks passed. |
| Injected rate limiting | HTTP 429 from minutes 100–112; failure feedback and subsequent recovery checks passed. |
| Network loss | Browser offline from minutes 145–152; scheduled recovery passed after reconnection. |
| Server restart | Restarted on the same port at minute 200; the dashboard recovered and settings persisted. |
| Browser errors | Zero recorded JavaScript errors or crashes. |
| Request budget | 18 simulated Open-Meteo upstream calls (limit: 48); 23 simulated RainViewer metadata calls. |
| Cache | At most 2 entries across 302 samples, below the 64-entry bound. |
| Memory | Server resident memory approximately 68–77 MiB; browser JavaScript heap 5.5–7.9 MiB. No configured memory/growth limit exceeded. Browser heap ended at about 6.6 MiB versus 6.0 MiB at minute 15. |
| Separate live probes | Open-Meteo and RainViewer metadata passed at both start and finish: four successful requests. |

### Scope and limits

The sustained browser run used synthetic provider responses and map tiles, with normal application refresh timers and radar animation. Only the four explicitly bounded probes contacted live weather services. The test did not validate live radar tile imagery, provider-account plans, forecast accuracy, or continuous external-service availability.

Memory measurements cover this five-hour run and include a server restart. They are a useful regression screen, not proof of indefinite leak-free operation. Offline recovery was browser network emulation; it does not establish behavior through a physical power loss or SD-card fault.

This run did not publish an image to Docker Hub, change deployments, or verify physical Raspberry Pi hardware/touch interaction. Regular Docker CI separately checks native AMD64/ARM64 startup and persistence and emulated ARMv7. A sustained run on the intended Pi/display remains the next hardware-validation step.

## Reproduce the stability checks

The soak harness is on the tested commit, separate from the application baseline. Inspect the [workflow](https://github.com/SeanRiggs/pi-weather-station/blob/edf642f62f2b236b6558e357d4e4bb9bae38af35/.github/workflows/soak.yml) and [browser harness](https://github.com/SeanRiggs/pi-weather-station/blob/edf642f62f2b236b6558e357d4e4bb9bae38af35/tests/soak-browser.cjs).

Use a disposable checkout with Node 24 and Chromium available:

```sh
git clone https://github.com/SeanRiggs/pi-weather-station.git pi-weather-station-soak
cd pi-weather-station-soak
git checkout --detach edf642f62f2b236b6558e357d4e4bb9bae38af35
npm ci --ignore-scripts
npm --prefix client ci --ignore-scripts
npm run build
npx playwright install chromium
node tests/soak-browser.cjs preflight && SOAK_MINUTES=300 node tests/soak-browser.cjs soak
```

Run the soak only after preflight passes. On Linux, browser system dependencies may also be required; see [Contributing](../CONTRIBUTING.md#verify-a-change). Reports are written under `test-results/soak-preflight/` and `test-results/soak-soak/`. The test uses temporary settings files and a local test server. Live probe failures are recorded separately, so inspect `liveChecks` even if the overall job passes.

For routine changes, start with the shorter [development checks](../CONTRIBUTING.md#verify-a-change).
