import axios from 'axios';
const http = axios.create({ timeout: 15000 });
http.interceptors.response.use(response => response, error => {
  // Axios errors contain request bodies; do not propagate entered API keys into console logs.
  const message = error.response?.data?.message;
  return Promise.reject(new Error(typeof message === 'string' ? message : 'Request failed. Check connection and provider settings.'));
});
export default http;
