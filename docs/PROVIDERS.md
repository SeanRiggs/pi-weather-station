# Weather and map providers

[Back to the README](../readme.md) · [Settings and troubleshooting](OPERATIONS.md)

## Start without provider accounts

Version 3.1 uses **Open-Meteo weather and OpenStreetMap** for a new installation. Choose your latitude/longitude in Settings or allow browser location access: no weather key, map token, or credit card is required. RainViewer past radar and Sunrise-Sunset also need no accounts. Location names are optional; without LocationIQ, the dashboard shows coordinates.

This default is intended for **personal, noncommercial home displays**, subject to each provider's terms and coverage. It needs Internet access. It is not an unlimited hosted service or an offline map package.

Already have Tomorrow.io or Mapbox keys? Existing settings retain those providers automatically. Use the provider dropdowns in Settings to switch; saved keys are retained, so switching back is straightforward. An explicitly selected Tomorrow.io/Mapbox provider requires its key/token. There is no silent provider fallback.

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

