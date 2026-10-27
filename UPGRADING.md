# Upgrade to version 3

## Version 3.0 → 3.1

Rebuild/restart using the same settings volume. Existing Tomorrow.io and Mapbox keys continue selecting those providers when no explicit provider choice is stored. New installations default to Open-Meteo and OpenStreetMap, with no keys. To switch an existing installation, choose the providers in Settings and save; saved keys are retained. Do not replace an existing private settings file with the example file.

The new optional fields are `weatherProvider` (`open-meteo` or `tomorrow`) and `mapProvider` (`osm` or `mapbox`). Open-Meteo's free endpoint is for noncommercial use. The map uses standard OSM streets in both themes. No Docker Hub tags are republished by this source update.

## Earlier installations

Back up your settings before replacing files, rebuilding, or pulling a different image. Stop the existing app while migrating; keep its data until you have verified the new dashboard. The repository update does not change a live deployment for you.

## Source installations

1. Copy the existing `settings.json` to a private location outside the checkout. Do not commit it.
2. Install a maintained Node 24 version (Node 22 is tested too), update the repository, and run `npm ci`, `npm --prefix client ci`, then `npm run build`.
3. Retain only the supported settings keys: `weatherApiKey`, `mapApiKey`, `reverseGeoApiKey`, `startingLat`, `startingLon`, and the optional `weatherProvider`/`mapProvider` fields described above. Mapbox needs a public `pk.` token. Check the Tomorrow.io account/key and permissions; changing a hostname does not upgrade old service credentials.
4. Place the settings file at the repository root or set `SETTINGS_FILE` to its private path. Make it readable/writable by the server account with mode `0600`.
5. Run `npm start`, open the local URL, and verify location, weather, charts, radar, settings save/reload, and units. The app no longer launches a browser automatically.

The production client is now built from source with hashed filenames; the repository's old compiled `client/dist` bundles have been removed. Do not keep serving a copied old bundle.

## Existing Docker installations

The old examples mounted an entire named volume at `/app`. That volume may contain an old copy of the application and its `settings.json`; mounting it on a new image can prevent code updates from taking effect.

1. Export your settings **before** stopping the existing container. If the container is named `weather-station` and settings are in the documented old location:

   ```sh
   docker cp weather-station:/app/settings.json ./settings.backup.json
   chmod 600 settings.backup.json
   ```

   Verify that the file exists and contains your expected configuration using a private editor. If it is not there, inspect the old container's mounts/configuration and locate the real file. Do not publish its contents.

2. Stop the old deployment. Do not remove its volumes. Obtain this updated repository, and build the new image:

   ```sh
   docker compose build
   ```

3. Import the exported JSON into the new Compose project's `/data` volume. This helper validates the file and refuses to overwrite existing settings:

   ```sh
   docker compose run --rm --no-deps --user root -e IMPORT_UID=1000 \
     -v "$PWD/settings.backup.json:/import/settings.json:ro" \
     weather-station node scripts/import-settings.js /import/settings.json
   ```

   It makes the imported file readable by the image's normal UID 1000. If settings already exist, investigate that volume instead of deleting it or forcing a replacement. If validation fails, use a private editor to check the supported fields/public Mapbox token against `settings.example.json`; keep the original export.

4. Start and inspect the new deployment:

   ```sh
   docker compose up -d
   docker compose logs --tail=50
   ```

5. Check the dashboard on the host at `http://127.0.0.1:8080`, then recreate the container and confirm that your settings survive. Retain the old volume/export until satisfied; only then decide whether to remove old application volumes.

Use the root Compose file as the primary configuration. The legacy architecture-specific paths now build from source into `/data` too; they do not pull a refreshed Docker Hub image.

## ARMv7 / 32-bit Raspberry Pi OS

Node 24 official Debian images no longer provide ARMv7. This project keeps a Node 22 source-build path for existing 32-bit installations:

```sh
NODE_VERSION=22 docker compose up -d --build
```

Use the same `NODE_VERSION=22` setting for all build/import commands on that host. The legacy ARMv7 Compose example sets that build argument explicitly. CI checks ARMv7 under emulation; actual touchscreen/device performance is not certified. Prefer a 64-bit OS on compatible Pi hardware and plan to migrate before Node 22's support ends. There are no ARMv6/first-generation Pi builds in this refresh.

## Behavior changes to check

- Weather and optional LocationIQ keys show `[configured]` after saving. Keep that text to retain the saved key; clear it to remove the key.
- Settings are no longer returned wholesale. Unknown/invalid fields and corrupt files cause a clear error rather than a silent reset.
- The old external IP-geolocation lookup is removed. Configure fixed coordinates or grant browser location permission; LAN HTTP pages may not have browser geolocation access.
- CORS is no longer unrestricted. Nonlocal hostnames require an explicit allowlist and password; use HTTPS/private tunneling for remote access.
- RainViewer animation shows past frames in Universal Blue, with native zoom capped at 7.
- Existing Docker Hub tags are separate releases. Building this checkout does not republish or upgrade those tags.
