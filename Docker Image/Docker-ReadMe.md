# Docker deployment

For Portainer's Web editor, use the separate [Portainer guide](../docs/PORTAINER.md) and [image-only stack](../compose.portainer.yml). The public GHCR image does not require a registry login. The instructions below build locally from source.

Use the repository-root [Compose file](../compose.yml) and [Dockerfile](../Dockerfile) for a reproducible source build:

```sh
git clone https://github.com/SeanRiggs/pi-weather-station.git
cd pi-weather-station
docker compose up -d --build
```

The image is named `pi-weather-station:local`. It runs as UID/GID 1000 and listens on port 8080 inside the container; Compose publishes it only at `127.0.0.1:8080` on the host. Settings persist in the named `weather-data` volume at `/data/settings.json`. Do not mount a persistent volume over `/app`.

| Container platform | Runtime | Verification |
| --- | --- | --- |
| `linux/amd64` | Node 24 Debian slim | Native build and persistence smoke tests in CI. |
| `linux/arm64` | Node 24 Debian slim | Native build and persistence smoke tests in CI. |
| `linux/arm/v7` | Node 22 Debian slim | Emulated build and persistence smoke tests in CI; set `NODE_VERSION=22`. |

For ARMv7:

```sh
NODE_VERSION=22 docker compose up -d --build
```

A 64-bit OS is recommended on capable Raspberry Pi hardware. The ARMv7 path uses Node 22 because Node 24 does not ship official ARMv7 images. ARMv6 and other architectures are not tested by this project.

The folders `Docker YML AMD64`, `Docker YML ARM`, and `Docker YML ARMv7` remain as compatibility examples. Their build contexts point back to this repository. Prefer the root Compose file for new setups.

**Registry status:** `ghcr.io/seanriggs/pi-weather-station:3.1.0` is published for AMD64/ARM64/ARMv7 with anonymous access verified. It is the image used by the Portainer stack. This does not publish version 3 to Docker Hub. Older `seanriggs/pi-weather-station` tags are legacy images and must not be described as containing these changes without a separate verified registry release.

Read [UPGRADING.md](../UPGRADING.md) before changing an existing container, especially if it uses `appdata:/app`. There is a settings export/import procedure that preserves the old volume and refuses to overwrite a new settings file.

See the [main README](../readme.md) for provider accounts, browser setup, optional password/allowed hosts, limitations, and test commands. No Docker Hub publishing token is needed to build or run locally.
