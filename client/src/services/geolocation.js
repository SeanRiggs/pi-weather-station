import axios from "~/services/http";

/**
 * Gets coordinates from `navigator.geolocation` (currently not supported on aspbian Chromium)
 *
 * @returns {Promise} coordinates
 */
export function getCoordsFromBrowser() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        if (!pos || (pos && !pos.coords)) {
          reject("Could not get current position");
        } else {
          resolve(pos.coords);
        }
      }, reject, { timeout: 10000, maximumAge: 3600000 });
    } else {
      reject(null);
    }
  });
}

/**
 * Gets coordinates from an external API
 *
 * @returns {Promise} coordinates
 */
export function getCoordsFromApi() {
  return getCoordsFromBrowser().catch(() => axios.get("/geolocation").then(({ data }) => data));
}
