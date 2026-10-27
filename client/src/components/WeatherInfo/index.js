import React, { useEffect, useContext, useState, useCallback } from "react";
import Spinner from "~/components/Spinner";
import { AppContext } from "~/AppContext";
import styles from "./styles.css";
import LocationName from "~/components/LocationName";
import CurrentWeather from "~/components/CurrentWeather";
import DailyChart from "~/components/weatherCharts/DailyChart";
import HourlyChart from "~/components/weatherCharts/HourlyChart";

const CURRENT_WEATHER_DATA_UPDATE_INTERVAL = 10 * 60 * 1000; //every 10 minutes
const HOURLY_WEATHER_DATA_UPDATE_INTERVAL = 60 * 60 * 1000; //every hour
const DAILY_WEATHER_DATA_UPDATE_INTERVAL = 60 * 60 * 1000; //every day

/**
 * Displays weather info
 *
 * @returns {JSX.Element} Clock component
 */
const WeatherInfo = () => {
  const {
    getWeatherApiKey,
    getReverseGeoApiKey,
    reverseGeoApiKey,
    updateCurrentWeatherData,
    updateHourlyWeatherData,
    updateDailyWeatherData,
    mapGeo,
    weatherApiKey,
    currentWeatherDataErr,
    currentWeatherDataErrMsg,
    hourlyWeatherDataErr,
    dailyWeatherDataErr,
    darkMode,
    setSettingsMenuOpen,
    currentWeatherData,
    updateSunriseSunset
  } = useContext(AppContext);

  const [err, setErr] = useState(null);

  const hourlyWeatherUpdateCb = useCallback(() => {
    updateSunriseSunset(mapGeo).catch(() => {});
    updateHourlyWeatherData(mapGeo).catch((err) => {
      console.log("err", err);
    });
  }, [updateHourlyWeatherData, updateSunriseSunset, mapGeo]);

  const dailyWeatherUpdateCb = useCallback(() => {
    updateDailyWeatherData(mapGeo).catch((err) => {
      console.log("err", err);
    });
  }, [updateDailyWeatherData, mapGeo]);

  const currentWeatherUpdateCb = useCallback(() => {
    updateCurrentWeatherData(mapGeo).catch((err) => {
      console.log("err", err);
    });
  }, [updateCurrentWeatherData, mapGeo]);

  useEffect(() => {
    setErr(false);
    if (!weatherApiKey) {
      getWeatherApiKey().catch((err) => {
        console.log("error getting weather api key:", err);
        setErr(true);
        setSettingsMenuOpen(true);
      });
    }
    if (!reverseGeoApiKey) {
      getReverseGeoApiKey().catch((err) => {
        console.log("error getting reverse geo api key:", err);
      });
    }
  }, [weatherApiKey, reverseGeoApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!weatherApiKey || !mapGeo) return;
    const callbacks = [currentWeatherUpdateCb, hourlyWeatherUpdateCb, dailyWeatherUpdateCb];
    const delays = [CURRENT_WEATHER_DATA_UPDATE_INTERVAL, HOURLY_WEATHER_DATA_UPDATE_INTERVAL, DAILY_WEATHER_DATA_UPDATE_INTERVAL];
    const timers = callbacks.map((cb, index) => { cb(); return setInterval(cb, delays[index]); });
    return () => timers.forEach(clearInterval);
  }, [weatherApiKey, mapGeo]);

  if (currentWeatherData) {
    return (
      <div className={styles.container}>
        {currentWeatherDataErr || hourlyWeatherDataErr || dailyWeatherDataErr ? <div role="status" style={{ fontSize: 11 }}>An update failed. Some displayed data is from the previous successful update.</div> : null}
        <div className={styles.location}>
          <LocationName />
        </div>
        <div>
          <CurrentWeather />
        </div>
        <div className={styles.weatherChart}>
          <HourlyChart />
        </div>
        <div className={styles.weatherChart}>
          <DailyChart />
        </div>
        <div style={{ fontSize: 9, marginTop: 4 }}><a href="https://www.tomorrow.io/" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Weather: Tomorrow.io</a> · <a href="https://sunrise-sunset.org/" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Sunrise-Sunset</a>{reverseGeoApiKey ? <> · <a href="https://locationiq.com/" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>LocationIQ</a></> : null}</div>
      </div>
    );
  } else if (currentWeatherData || currentWeatherDataErr || err) {
    return (
      <div
        className={`${styles.errContainer} ${
          darkMode ? styles.dark : styles.light
        }`}
      >
        <div>Could not retrieve weather data.</div>
        <div>Is your weather API key valid?</div>
        {currentWeatherDataErr ? (
          <div className={styles.message}>{currentWeatherDataErrMsg}</div>
        ) : null}
      </div>
    );
  } else {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size={"20px"} color={darkMode ? "#f6f6f444" : "#3a393844"} />
      </div>
    );
  }
};

export default WeatherInfo;
