import React, { useContext, useState, useEffect } from "react";
import styles from "./styles.css";
import { AppContext } from "~/AppContext";
import { CSSTransition } from "react-transition-group";
import { InlineIcon } from "@iconify/react";
import closeFilled from "@iconify/icons-carbon/close-filled";
import roundSaveAlt from "@iconify/icons-ic/round-save-alt";
import undoIcon from "@iconify/icons-dashicons/undo";
import closeSharp from "@iconify/icons-ion/close-sharp";
import PropTypes from "prop-types";
import "./animations.css";

/**
 * Settings page
 *
 * @returns {JSX.Element} Settings page
 */
const Settings = () => {
  const {
    settingsMenuOpen,
    weatherApiKey,
    weatherProvider,
    mapProvider,
    mapApiKey,
    reverseGeoApiKey,
    customLat,
    customLon,
    setSettingsMenuOpen,
    mouseHide,
    saveMouseHide,
  } = useContext(AppContext);

  const [weatherSource, setWeatherSource] = useState("open-meteo");
  const [mapSource, setMapSource] = useState("osm");
  const [mapsKey, setMapsKey] = useState(null);
  const [weatherKey, setWeatherKey] = useState(null);
  const [geoKey, setGeoKey] = useState(null);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);

  const [currentMapsKey, setCurrentMapsKey] = useState(null);
  const [currentWeatherKey, setCurrentWeatherKey] = useState(null);
  const [currentGeoKey, setCurrentGeoKey] = useState(null);
  const [currentLat, setCurrentLat] = useState(null);
  const [currentLon, setCurrentLon] = useState(null);

  useEffect(() => {
    setCurrentMapsKey(mapApiKey);
    setCurrentWeatherKey(weatherApiKey);
    setCurrentGeoKey(reverseGeoApiKey);
    setCurrentLat(customLat);
    setCurrentLon(customLon);
  }, [
    mapApiKey,
    weatherApiKey,
    weatherProvider,
    mapProvider,
    reverseGeoApiKey,
    customLat,
    customLon,
    currentGeoKey,
    mouseHide,
    saveMouseHide,
  ]);

  useEffect(() => {
    setWeatherSource(weatherProvider || "open-meteo");
    setMapSource(mapProvider || "osm");
    setMapsKey(mapApiKey || "");
    setWeatherKey(weatherApiKey || "");
    setGeoKey(reverseGeoApiKey || "");
    setLat(customLat == null ? "" : customLat);
    setLon(customLon == null ? "" : customLon);
  }, [mapApiKey, weatherApiKey, reverseGeoApiKey, customLon, customLat, weatherProvider, mapProvider, settingsMenuOpen]);

  return (
    <CSSTransition
      in={settingsMenuOpen}
      unmountOnExit
      timeout={300}
      classNames="animate"
    >
      <div className={styles.container}>
        <div className={styles.header}>SETTINGS</div>
        <div style={{ padding: "0 20px", fontSize: "12px" }}>Start with your location. Open-Meteo weather and OpenStreetMap need no accounts or keys for a personal home display.</div>
        <div
          className={styles.closeButton}
          onClick={() => {
            setSettingsMenuOpen(false);
          }}
        >
          <InlineIcon icon={closeSharp} />
        </div>
        <div className={styles.settingsContainer}>
          <ToggleButtons />
          <Input label="CUSTOM STARTING LATITUDE" val={lat} cb={setLat} current={currentLat} />
          <Input label="CUSTOM STARTING LONGITUDE" val={lon} cb={setLon} current={currentLon} />
          <p style={{ fontSize: 12 }}>Leave coordinates blank to use browser location permission. You can also click the map to explore.</p>
          <div className={styles.settingsItem}>
            <label htmlFor="weather-source">Weather provider</label>
            <select id="weather-source" value={weatherSource} onChange={e => setWeatherSource(e.target.value)}>
              <option value="open-meteo">Open-Meteo — no account</option>
              <option value="tomorrow">Tomorrow.io — API key</option>
            </select>
            <p style={{ fontSize: 12 }}>Open-Meteo is free for personal, noncommercial use. <a href="https://open-meteo.com/en/terms" target="_blank" rel="noreferrer">Usage terms</a></p>
          </div>
          {weatherSource === "tomorrow" ? <Input label="TOMORROW.IO API KEY" val={weatherKey} current={currentWeatherKey} cb={setWeatherKey} required={true} /> : null}
          <div className={styles.settingsItem}>
            <label htmlFor="map-source">Map provider</label>
            <select id="map-source" value={mapSource} onChange={e => setMapSource(e.target.value)}>
              <option value="osm">OpenStreetMap — no account</option>
              <option value="mapbox">Mapbox — public token</option>
            </select>
            <p style={{ fontSize: 12 }}>OpenStreetMap uses a standard street map in both themes. Public tiles are best-effort; no offline downloads.</p>
          </div>
          {mapSource === "mapbox" ? <Input label="MAPBOX PUBLIC TOKEN (pk.)" val={mapsKey} current={currentMapsKey} cb={setMapsKey} required={true} /> : null}
          <details>
            <summary>Optional location names and saved keys</summary>
            <p style={{ fontSize: 12 }}>LocationIQ adds place names; otherwise coordinates are shown. Saved private keys appear as [configured]. Leave that text to keep a key. Switching providers retains your saved keys.</p>
            <Input label="LOCATIONIQ API KEY (OPTIONAL)" val={geoKey} current={currentGeoKey} cb={setGeoKey} />
          </details>
          <div className={styles.bottomButtonContainer}>
            <div>
              <div className={styles.label}>HIDE MOUSE</div>
              <ToggleButton
                button1Label={"ON"}
                button2Label={"OFF"}
                val={mouseHide}
                button1Val={true}
                button2Val={false}
                cb={saveMouseHide}
              />
            </div>
            <div className={styles.saveButtonContainer}>
              <SaveButton
                weatherSource={weatherSource}
                mapSource={mapSource}
                mapsKey={mapsKey}
                weatherKey={weatherKey}
                geoKey={geoKey}
                lat={lat}
                lon={lon}
              />
            </div>
          </div>
        </div>
      </div>
    </CSSTransition>
  );
};

export default Settings;

/**
 * Save button
 *
 * @param {Object} props
 * @param {String} [props.mapsKey]
 * @param {String} [props.weatherKey]
 * @param {String} [props.geoKey]
 * @param {String} [props.lat]
 * @param {String} [props.lon]
 * @returns {JSX.Element} Save button
 */
const SaveButton = ({ mapsKey, weatherKey, geoKey, lat, lon, weatherSource, mapSource }) => {
  const { saveSettingsToJson, setSettingsMenuOpen, mouseHide } = useContext(
    AppContext
  );
  const [saveError, setSaveError] = useState("");
  return (
    <div>
    <div
      role="button"
      aria-label="Save settings"
      className={`${styles.button} ${styles.saveButton} ${
        !mouseHide ? styles.showMouse : ""
      }`}
      onClick={() => {
        setSaveError("");
        saveSettingsToJson({ mapsKey, weatherKey, geoKey, lat, lon, weatherSource, mapSource })
          .then(() => {
            setSettingsMenuOpen(false);
          })
          .catch((err) => {
            setSaveError(err.message);
          });
      }}
    >
      <div className={styles.label}>SAVE</div>
      <div>
        <InlineIcon icon={roundSaveAlt} />
      </div>
    </div>
    {saveError ? <div role="alert" style={{ maxWidth: 200, fontSize: 12, marginTop: 8, overflowWrap: "anywhere" }}>{saveError}</div> : null}
    </div>
  );
};

SaveButton.propTypes = {
  weatherSource: PropTypes.string,
  mapSource: PropTypes.string,
  mapsKey: PropTypes.string,
  weatherKey: PropTypes.string,
  geoKey: PropTypes.string,
  lat: PropTypes.string,
  lon: PropTypes.string,
};

/**
 * Toggle Buttons Group
 *
 * @returns {JSX.Element} A grouping of toggle buttons
 */
const ToggleButtons = () => {
  const {
    tempUnit,
    saveTempUnit,
    speedUnit,
    saveSpeedUnit,
    lengthUnit,
    saveLengthUnit,
    clockTime,
    saveClockTime,
  } = useContext(AppContext);

  return (
    <div>
      <div className={styles.label}>UNITS</div>
      <div className={styles.toggleButtons}>
        <div>
          <ToggleButton
            button1Label={"F"}
            button2Label={"C"}
            val={tempUnit}
            button1Val={"f"}
            button2Val={"c"}
            cb={saveTempUnit}
          />
        </div>
        <div>
          <ToggleButton
            button1Label={"mph"}
            button2Label={"m/s"}
            val={speedUnit}
            button1Val={"mph"}
            button2Val={"ms"}
            cb={saveSpeedUnit}
          />
        </div>
        <div>
          <ToggleButton
            button1Label={"in"}
            button2Label={"mm"}
            val={lengthUnit}
            button1Val={"in"}
            button2Val={"mm"}
            cb={saveLengthUnit}
          />
        </div>
        <div>
          <ToggleButton
            button1Label={"12h"}
            button2Label={"24h"}
            val={clockTime}
            button1Val={"12"}
            button2Val={"24"}
            cb={saveClockTime}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Toggle buttons
 *
 * @param {Object} props
 * @param {String} props.button1Label PropTypes.string.isRequired,
 * @param {String} props.button2Label PropTypes.string.isRequired,
 * @param {*} props.val PropTypes.string.isRequired,
 * @param {*} props.button1Val PropTypes.string.isRequired,
 * @param {*} props.button2Val PropTypes.string.isRequired,
 * @param {Function} props.cb PropTypes.func.isRequired,
 * @returns {JSX.Element} Toggle buttons
 */
const ToggleButton = ({
  button1Label,
  button2Label,
  val,
  button1Val,
  button2Val,
  cb,
}) => {
  return (
    <div className={styles.toggleContainer}>
      <div
        className={` ${styles.button} ${button1Val === val ? styles.down : ""}`}
        onClick={() => {
          cb(button1Val);
        }}
      >
        {button1Label}
      </div>
      <div
        className={` ${styles.button} ${button2Val === val ? styles.down : ""}`}
        onClick={() => {
          cb(button2Val);
        }}
      >
        {button2Label}
      </div>
    </div>
  );
};

ToggleButton.propTypes = {
  button1Label: PropTypes.string.isRequired,
  button2Label: PropTypes.string.isRequired,
  val: PropTypes.any.isRequired,
  button1Val: PropTypes.any.isRequired,
  button2Val: PropTypes.any.isRequired,
  cb: PropTypes.func.isRequired,
};

/**
 * Delete button
 *
 * @param {Object} props
 * @param {Function} props.cb callback
 * @returns {JSX.Element} Delete button
 */
const DeleteButton = ({ cb }) => {
  return (
    <div className={styles.button} onClick={cb}>
      <InlineIcon icon={closeFilled} />
    </div>
  );
};

DeleteButton.propTypes = {
  cb: PropTypes.func.isRequired,
};

/**
 * Undo button, restores input to default value
 *
 * @param {Object} props
 * @param {Function} props.cb callback
 * @returns {JSX.Element} Undo button
 */
const UndoButton = ({ cb }) => {
  return (
    <div className={styles.button} onClick={cb}>
      <InlineIcon icon={undoIcon} />
    </div>
  );
};

UndoButton.propTypes = {
  cb: PropTypes.func.isRequired,
};

/**
 * Settings input
 *
 * @param {Object} props
 * @param {String} props.label Label
 * @param {String} props.val value
 * @param {Function} props.cb change callback
 * @param {String} props.current current default value
 * @param {Boolean} [props.required] If input is required
 * @returns {JSX.Element} Input
 */
const Input = ({ label, val, cb, required, current }) => {
  const [inputValue, setInputValue] = useState(val);
  const [defaultValue, setDefaultValue] = useState(null);

  useEffect(() => {
    if ((val || val === "") && (!defaultValue || defaultValue === "")) {
      setDefaultValue(val);
    }
    setInputValue(val);
  }, [val, defaultValue]);
  return (
    <div className={styles.settingsItem}>
      <div className={styles.label}>{label}</div>
      <div
        className={`${styles.inputContainer} ${
          required && !val ? styles.invalid : ""
        }`}
      >
        <input
          type={label.includes("KEY") || label.includes("TOKEN") ? "password" : "text"}
          aria-label={label}
          autoComplete="off"
          placeholder={"None"}
          value={inputValue || ""}
          onChange={(e) => {
            const { value } = e.target;
            setInputValue(value);
            cb(value);
          }}
        />

        <div className={styles.buttonContainer}>
          <DeleteButton
            cb={() => {
              setInputValue("");
              cb("");
            }}
          />
          <UndoButton
            cb={() => {
              setInputValue(current);
              cb(current);
            }}
          />
        </div>
      </div>
    </div>
  );
};

Input.propTypes = {
  label: PropTypes.string,
  val: PropTypes.string,
  cb: PropTypes.func.isRequired,
  required: PropTypes.bool,
  current: PropTypes.string,
};
