import http from "~/services/http";
export default function reverseGeocode({ lat, lon }) {
  return http.get("/api/reverse", { params: { lat, lon } }).then(({ data }) => data);
}
