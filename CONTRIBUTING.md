# Contributing

[Back to the README](readme.md) · [Verification results](docs/TESTING.md)

Help make the dashboard easier to install, use, and maintain. Focused fixes, clearer guides, and reproducible bug reports are welcome.

## Set up a development checkout

Use Node.js 24 (server tests also cover Node 22), Git, and a current Chromium-based browser.

```sh
git clone https://github.com/SeanRiggs/pi-weather-station.git
cd pi-weather-station
npm ci
npm --prefix client ci
npm run build
npm start
```

Open http://127.0.0.1:8080. Run `npm run build` again after client changes; `npm start` serves the built client. Fork the repository and create a branch for changes you want to contribute.

## Verify a change

From the repository root, after installing both sets of dependencies:

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm audit --omit=dev
npm --prefix client audit --omit=dev
```

On Linux, Playwright may also require browser system dependencies; `npx playwright install --with-deps chromium` installs them where you have permission. Alternatively, set `BROWSER_PATH` to an installed Chrome/Chromium executable. CI uses the runner's installed Chrome.

The server tests use disposable settings files and simulated provider responses, plus a local HTTP timeout test. Browser tests run the built UI with fake provider data and tiles; they cover no-account setup/reload, provider switching with retained keys, first-run setup, zero coordinates, current weather/charts, radar URLs, key masking, save/reload, invalid settings, and a narrow viewport. They never use real account keys. Docker CI builds and checks startup, nonroot execution, and settings retention across container recreation on AMD64/ARM64, plus ARMv7 emulation with Node 22.



The UI retains compatible React/Leaflet/chart component versions while using updated build tooling and locked dependencies. Coordinate major framework or provider redesigns in an issue before building a large change.

## Useful contributions

- Improve keyboard and touchscreen usability while preserving the 800 × 480 dashboard.
- Reproduce issues on physical Raspberry Pi hardware and document the OS, architecture, browser, and display used.
- Strengthen outage/recovery tests with synthetic fixtures and bounded requests.
- Improve setup, migration, and troubleshooting instructions.
- Propose provider integrations with clear licensing, account requirements, attribution, and data semantics.

These are contribution ideas, not claims that a feature or hardware configuration has already been verified.

## Report a problem or open a pull request

Use [Issues](https://github.com/SeanRiggs/pi-weather-station/issues) for a reproducible bug or a scoped proposal. Include installation method, version/commit, architecture, browser, steps to reproduce, expected result, and actual result.

For a pull request, describe what changes for users and which checks you ran. Add regression coverage when behavior changes; documentation-only edits should verify their commands and links against the repository. Use synthetic provider fixtures for automated tests.

Never include API keys, passwords, private settings, or unredacted logs. Keep provider attribution and the original MIT copyright. See [LICENSE](LICENSE).
