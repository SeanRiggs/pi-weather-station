# Install with Portainer

[Back to the README](../readme.md) · [Upgrade an existing installation](../UPGRADING.md)

> Release activation pending: the maintainer must enable public access to the GitHub container package and verify an anonymous pull before this becomes the recommended installation path. The instructions below are prepared for that public release.

This setup is for **Portainer with a Docker Standalone environment** on Linux. It pulls a prebuilt image, so you do not need Git, Node.js, a terminal, or a local source checkout. Docker Swarm and Kubernetes are outside this guide.

The versioned image supports Intel/AMD 64-bit, ARM64, and ARMv7. Docker selects the matching architecture automatically. It is hosted at GitHub Container Registry (GHCR), separately from the older Docker Hub images.

## 1. Add the stack

In Portainer, open the Docker environment that will run the dashboard. Select **Stacks → Add stack**, name it **weather-station**, and choose **Web editor**.

Paste this complete stack (also available as [compose.portainer.yml](../compose.portainer.yml)):

```yaml
# Portainer: Stacks > Add stack > Web editor.
# Set WEATHER_HOST and DASHBOARD_PASSWORD in Environment variables below the editor.
services:
  weather-station:
    image: ${WEATHER_IMAGE:-ghcr.io/seanriggs/pi-weather-station:3.1.0}
    ports:
      - "${WEATHER_PORT:-8080}:8080"
    environment:
      ALLOWED_HOSTS: "localhost,127.0.0.1,[::1],${WEATHER_HOST:?Set WEATHER_HOST to your server IP or hostname without a scheme or port}"
      DASHBOARD_PASSWORD: "${DASHBOARD_PASSWORD:?Set a unique dashboard password}"
    volumes:
      - weather-data:/data
    restart: unless-stopped

volumes:
  weather-data:
```

No other files are needed. This stack deliberately has no `build:` section; Portainer documents [build limitations on remote Docker environments](https://docs.portainer.io/faqs/known-issues/docker-compose-files-including-build-steps-fail).

## 2. Enter two values

Expand **Environment variables** below the editor and add these rows. Enter the actual values without quotation marks.

| Name | What to enter | Example |
| --- | --- | --- |
| `WEATHER_HOST` | The Docker host's LAN IP address or hostname, without `http://`, a port, or a path. Use the same address when opening the dashboard. | `192.168.1.50` |
| `DASHBOARD_PASSWORD` | A unique password of your own choosing. You will use it to open the dashboard. | Choose your own; do not reuse a provider or GitHub password. |

If Portainer and the dashboard share a machine, an address such as `https://192.168.1.50:9443` points to host `192.168.1.50`. If Portainer manages a different machine through an agent, use that selected Docker host's address instead.

Optional: add `WEATHER_PORT` if port 8080 is already in use, for example `8085`. Leave it unset otherwise. The internal application port stays 8080.

## 3. Deploy and open

Click **Deploy the stack**. Wait for the image download and container startup.

Open `http://YOUR-SERVER-ADDRESS:8080` from a device that can reach that server. With the example above, that is `http://192.168.1.50:8080`. Use your selected port if you changed it.

When the browser asks for credentials:

- **Username:** `weather`
- **Password:** the value you entered for `DASHBOARD_PASSWORD`

These are dashboard credentials, separate from your Portainer login.

Open the dashboard's gear icon, set latitude and longitude, leave **Open-Meteo** and **OpenStreetMap** selected, and save. No weather-provider accounts are required for this personal, noncommercial setup. Coordinates appear instead of a city name unless you add the optional LocationIQ key.

This stack publishes the selected port on the host's network interfaces. Keep it on a private network; do not forward it from your router to the Internet. HTTP Basic authentication is not encrypted over HTTP. Use an HTTPS reverse proxy or encrypted private tunnel when password confidentiality is required. See [private access configuration](OPERATIONS.md#configuration).

## Settings and updates

Settings live in a Docker named volume mounted at `/data`. Keep the same stack name and volume when updating. Recreating a container retains settings; deleting the volume loses them. Do not mount an old application volume at `/app`.

For an update, back up your settings, open **Stacks → weather-station → Editor**, and change the image version to a new published release. Select **Update the stack**, then confirm the dashboard and saved settings. Version tags are intentionally fixed; updates are a deliberate choice.

For an older Docker Hub installation, follow [UPGRADING.md](../UPGRADING.md) before deploying a replacement. Do not run both on the same host port.

## Common problems

| Problem | Fix |
| --- | --- |
| Deployment asks for a missing variable | Add both required rows under Environment variables, then deploy again. |
| `denied` or `unauthorized` while pulling the image | Check the release-activation notice above. Public users should not need GitHub credentials. This is different from the dashboard's browser login. |
| Port is already allocated | Set `WEATHER_PORT` to an unused port and use it in your browser URL. |
| Browser cannot connect | Confirm the container is running, the selected Docker host address is correct, and the host firewall permits the port from your private network. |
| `Host is not allowed` | Match `WEATHER_HOST` to the address you typed into the browser, then update the stack. Do not add a scheme or port to the variable. |
| Browser asks for a username | Use `weather`, with your dashboard password. |
| Settings disappeared | Check whether the stack name or its named volume changed. Keep the original volume and consult the upgrade guide. |

See Portainer's [stack deployment documentation](https://docs.portainer.io/user/docker/stacks/add) for its editor and environment-variable controls.

## Maintainer release steps

The **Build and publish Portainer image** workflow uses the repository's built-in GitHub Actions token with package-write permission. No Docker Hub token is needed.

1. Update the application version and relevant release notes for a new release. Run the standard CI checks.
2. Run the publishing workflow manually from `master`. It builds and smoke-tests AMD64, ARM64, and ARMv7, exercises the stack through Portainer CE, then assembles the versioned manifest. An existing release tag is never overwritten.
3. For the first package only, open [the package page](https://github.com/users/SeanRiggs/packages/container/package/pi-weather-station), then **Package settings → Danger Zone → Change visibility → Public**. GitHub requires confirmation of the package name. This makes the built image publicly downloadable.
4. Verify an anonymous pull of the published version. The workflow records publication and anonymous access separately; a successful publication alone does not establish public availability.
5. Update the stack's default version and this guide together. Only remove the release-activation notice after public access is verified.

Regular CI uses a locally built image to validate the Portainer deployment and saved settings without publishing. Publishing is a separate, intentional release action. Docker Hub tags are unaffected.
