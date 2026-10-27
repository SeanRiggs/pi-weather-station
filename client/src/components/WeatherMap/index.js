import React, {
  useEffect,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { Map, TileLayer, AttributionControl, Marker } from "react-leaflet";
import PropTypes from "prop-types";
import { AppContext } from "~/AppContext";
import debounce from "debounce";
import axios from "~/services/http";
import styles from "./styles.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

/**
 * Weather map
 *
 * @param {Object} props
 * @param {Number} props.zoom zoom level
 * @param {Boolean} [props.dark] dark mode
 * @returns {JSX.Element} Weather map
 */
const WeatherMap = ({ zoom, dark }) => {
  const MAP_CLICK_DEBOUNCE_TIME = 200; //ms
  const {
    setMapPosition,
    panToCoords,
    setPanToCoords,
    browserGeo,
    mapGeo,
    mapApiKey,
    mapProvider,
    getMapApiKey,
    markerIsVisible,
    animateWeatherMap,
  } = useContext(AppContext);
  const mapRef = useRef();

  const mapClickHandler = useCallback(
    debounce((e) => {
      const { lat: latitude, lng: longitude } = e.latlng;
      const newCoords = { latitude, longitude };
      setMapPosition(newCoords);
    }, MAP_CLICK_DEBOUNCE_TIME),
    [setMapPosition]
  );

  const [mapTimestamps, setMapTimestamps] = useState(null);
  const [baseMapError, setBaseMapError] = useState(false);
  useEffect(() => setBaseMapError(false), [mapProvider, mapApiKey]);
  const [radarError, setRadarError] = useState(false);
  const [mapTimestamp, setMapTimestamp] = useState(null);
  const [currentMapTimestampIdx, setCurrentMapTimestampIdx] = useState(0);

  const MAP_TIMESTAMP_REFRESH_FREQUENCY = 1000 * 60 * 10; //update every 10 minutes
  const MAP_CYCLE_RATE = 1000; //ms

  const getMapApiKeyCallback = useCallback(() => getMapApiKey(), [
    getMapApiKey,
  ]);

  useEffect(() => {
    getMapApiKeyCallback().catch((err) => {
      console.log("err!", err);
    });

    const updateTimeStamps = () => {
      getMapTimestamps()
        .then((res) => {
          setMapTimestamps(res);
          setCurrentMapTimestampIdx(res.length - 1);
          setRadarError(false);
        })
        .catch((err) => {
          setRadarError(true);
        });
    };

    const mapTimestampsInterval = setInterval(
      updateTimeStamps,
      MAP_TIMESTAMP_REFRESH_FREQUENCY
    );
    updateTimeStamps(); //initial update
    return () => {
      clearInterval(mapTimestampsInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan the screen to a a specific location when `panToCoords` is updated with grid coordinates
  useEffect(() => {
    if (panToCoords && mapRef.current) {
      const { leafletElement } = mapRef.current;
      leafletElement.panTo([panToCoords.latitude, panToCoords.longitude]);
      setPanToCoords(null); //reset back to null so we can observe a change next time its fired for the same coords
    }
  }, [panToCoords, mapRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const { latitude, longitude } = browserGeo || {};

  useEffect(() => {
    if (mapTimestamps) {
      setMapTimestamp(mapTimestamps[currentMapTimestampIdx]);
    }
  }, [currentMapTimestampIdx, mapTimestamps]);

  // cycle through weather maps when animated is enabled
  useEffect(() => {
    if (mapTimestamps) {
      if (animateWeatherMap) {
        const interval = setInterval(() => {
          let nextIdx;
          if (currentMapTimestampIdx + 1 >= mapTimestamps.length) {
            nextIdx = 0;
          } else {
            nextIdx = currentMapTimestampIdx + 1;
          }
          setCurrentMapTimestampIdx(nextIdx);
        }, MAP_CYCLE_RATE);
        return () => {
          clearInterval(interval);
        };
      } else {
        setCurrentMapTimestampIdx(mapTimestamps.length - 1);
      }
    }
  }, [currentMapTimestampIdx, animateWeatherMap, mapTimestamps]);

  if (!hasVal(latitude) || !hasVal(longitude) || !zoom || !mapProvider || (mapProvider === "mapbox" && !mapApiKey)) {
    return (
      <div className={`${styles.noMap} ${dark ? styles.dark : styles.light}`}>
        <div>Cannot retrieve map data.</div>
        <div>Choose a location in Settings. Mapbox also needs a public token.</div>
      </div>
    );
  }
  const markerPosition = mapGeo ? [mapGeo.latitude, mapGeo.longitude] : null;

  return (
    <Map
      ref={mapRef}
      center={[latitude, longitude]}
      zoom={zoom}
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
      touchZoom={true}
      dragging={true}
      fadeAnimation={false}
      onClick={mapClickHandler}
    >
      <AttributionControl position={"bottomleft"} />
      {mapProvider === "mapbox" ? <TileLayer
        key="mapbox"
        onTileError={() => setBaseMapError(true)}
        onTileLoad={() => setBaseMapError(false)}
        attribution='© <a href="https://www.mapbox.com/feedback/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={`https://api.mapbox.com/styles/v1/mapbox/${
          dark ? "dark-v11" : "light-v11"
        }/tiles/{z}/{x}/{y}?access_token={apiKey}`}
        apiKey={mapApiKey}
        tileSize={512}
        zoomOffset={-1}
      /> : <TileLayer
        key="osm"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://www.openstreetmap.org/fixthemap">Report a map issue</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        keepBuffer={0}
        updateWhenIdle={true}
        onTileError={() => setBaseMapError(true)}
        onTileLoad={() => setBaseMapError(false)}
      />}
      {mapTimestamp ? (
        <TileLayer
          attribution='<a href="https://www.rainviewer.com/">RainViewer</a>'
          url={`${mapTimestamp.url}/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png`}
          maxNativeZoom={7}
          maxZoom={18}
          opacity={0.3}
          size={256}
          color={2} // https://www.rainviewer.com/api.html#colorSchemes
          smooth={1}
          snow={1}
        />
      ) : null}
      {baseMapError ? <div role="status" style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, background: "#222", color: "white", padding: 6 }}>Base map unavailable. Weather remains available.</div> : null}
      {radarError ? <div role="status" style={{ position: "absolute", bottom: 30, left: 10, zIndex: 1000, background: "#222", color: "white", padding: 6 }}>Radar unavailable; retrying on the next update.</div> : null}
      {markerIsVisible && markerPosition ? (
        <Marker position={markerPosition} opacity={0.65}></Marker>
      ) : null}
    </Map>
  );
};

WeatherMap.propTypes = {
  zoom: PropTypes.number.isRequired,
  dark: PropTypes.bool,
};

/**
 * Determines if truthy, but returns true for 0
 *
 * @param {*} i
 * @returns {Boolean} If truthy or zero
 */
function hasVal(i) {
  return !!(i || i === 0);
}

/**
 * Get timestamps for weather map
 *
 * @returns {Promise} Promise of timestamps
 */
function getMapTimestamps() {
  return axios.get("/api/radar").then(({ data }) => data);
}

export default WeatherMap;
