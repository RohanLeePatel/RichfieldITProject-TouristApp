import {
  ArrowRight,
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  Loader2,
  MapPin,
  Plane,
  RefreshCw,
  Search,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
} from "lucide-react";

import { useEffect, useState } from "react";

import ClimateInsights from "../components/insights/ClimateInsights.jsx";
import { geocodePlace } from "../api/climate.js";
import { fetchWeather as fetchWeatherFromApi } from "../api/weather";
import useActiveTrip from "../hooks/useActiveTrip.js";
import { splitDestination } from "../utils/countries.js";
import useTheme from "../components/recommendations/useTheme.js";
import PageTopBar from "../components/PageTopBar.jsx";
import "../styles/Weather.css";

// =========================================================
// API
// =========================================================

const GEOCODING_API =
  "https://geocoding-api.open-meteo.com/v1/search";

// =========================================================
// WEATHER HELPER
// =========================================================

// OpenWeather reports metric wind in m/s, which is a meteorologist's unit.
// Travellers read wind in km/h.
function kmh(metresPerSecond) {
  if (metresPerSecond == null) return "No wind data";
  return `${Math.round(metresPerSecond * 3.6)} km/h`;
}

function getWeatherInfo(weatherCode) {
  const description = String(weatherCode || "").toLowerCase();

  if (description.includes("thunder")) {
    return { label: "Thunderstorm", icon: CloudRain, type: "storm" };
  }

  if (description.includes("snow") || description.includes("sleet")) {
    return { label: "Snow", icon: Cloud, type: "snow" };
  }

  if (
    description.includes("rain") ||
    description.includes("shower") ||
    description.includes("drizzle")
  ) {
    return { label: "Rain", icon: CloudRain, type: "rain" };
  }

  if (description.includes("fog") || description.includes("mist")) {
    return { label: "Foggy", icon: Cloud, type: "cloud" };
  }

  if (description.includes("cloud")) {
    return {
      label: description.includes("overcast")
        ? "Overcast"
        : "Partly cloudy",
      icon: CloudSun,
      type: "cloud",
    };
  }

  if (description.includes("clear")) {
    return {
      label: "Clear sky",
      icon: Sun,
      type: "clear",
    };
  }

  return {
    label: "Unknown conditions",
    icon: Cloud,
    type: "cloud",
  };
}

// =========================================================
// DATE HELPERS
// =========================================================

const getDayName = (dateString) => {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
  });
};

const getShortDate = (dateString) => {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
};

// =========================================================
// WEATHER PAGE
// =========================================================

export default function Weather() {
  const { theme, toggle: toggleTheme } = useTheme(); // app-wide theme, also set in Settings
  // =======================================================
  // STATE
  // =======================================================

  // opens on the active trip's destination - typed once, in the wizard
  const { trip, loaded: tripsLoaded } = useActiveTrip();

  const [searchCity, setSearchCity] =
    useState("");

  const [location, setLocation] =
    useState(null);

  // the place the active trip opened on - while it's still the one shown,
  // the climate section shows the trip's month rather than this month
  const [tripPlace, setTripPlace] = useState(null);

  const [weather, setWeather] = useState(null);

  const [locationResults, setLocationResults] =
    useState([]);

  const [showLocationResults, setShowLocationResults] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  // =======================================================
  // FETCH WEATHER
  // =======================================================

  const fetchWeather = async (locationData = location) => {
    try {
      setLoading(true);
      setError("");

      // "Paris,FR" not just "Paris" - OpenWeather resolves bare names to
      // whichever place it likes (Paris, Texas), so pin the country.
      const data = await fetchWeatherFromApi(
        locationData.countryCode
          ? `${locationData.name},${locationData.countryCode}`
          : locationData.name
      );

      setWeather({
        ...data,
        location: locationData,
      });

      // the server's time of the reading, not ours - a cached reading is older
      setLastUpdated(data.fetched_at ? new Date(data.fetched_at) : new Date());
    } catch (err) {
      console.error(
        "Could not load weather:",
        err
      );

      setError(
        "Weather information is currently unavailable. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =======================================================
  // SEARCH LOCATION
  // =======================================================

  const searchLocation = async (event) => {
    event.preventDefault();

    const query = searchCity.trim();

    if (!query) {
      setError("Enter a destination to search for weather.");
      return;
    }
    if (query.length < 2 || !/\p{L}/u.test(query)) {
      setError("Enter at least 2 letters of a city or town name, like Durban.");
      return;
    }

    try {
      setError("");
      setShowLocationResults(false);

      const params = new URLSearchParams({
        name: query,
        count: "10",
        language: "en",
        format: "json",
      });

      const response = await fetch(
        `${GEOCODING_API}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(
          "Location search failed."
        );
      }

      const data = await response.json();

      const results = data.results || [];

      if (!results.length) {
        setLocationResults([]);
        setError(
          "No location was found. Try another city or town."
        );
        return;
      }

      setLocationResults(results);

      setShowLocationResults(true);
    } catch (err) {
      console.error(
        "Could not search location:",
        err
      );

      setError(
        "Could not search for that location."
      );
    }
  };

  // =======================================================
  // SELECT LOCATION
  // =======================================================

  const selectLocation = (result) => {
    const selectedLocation = {
      name: result.name,
      country:
        result.country || "",
      countryCode:
        result.country_code || "",
      admin1:
        result.admin1 || "",
      latitude: result.latitude,
      longitude: result.longitude,
    };

    setLocation(
      selectedLocation
    );

    setSearchCity(
      selectedLocation.name
    );

    setShowLocationResults(false);
    setLocationResults([]);
    setError("");

    fetchWeather(selectedLocation);
  };

  // =======================================================
  // REFRESH
  // =======================================================

  const refreshWeather = () => {
    if (location) fetchWeather(location);
  };

  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {
    if (!tripsLoaded || !trip?.destination) return;
    const { city, country } = splitDestination(trip.destination);
    // pin the trip's country, same reason as fetchWeather's "Paris,FR"
    geocodePlace(city, country)
      .catch(() => ({ name: city, country, countryCode: "" }))
      .then((place) => {
        setLocation(place);
        setTripPlace(place);
        setSearchCity(place.name);
        fetchWeather(place);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripsLoaded, trip?.id]);

  // =======================================================
  // FORMAT LAST UPDATED
  // =======================================================

  const formattedLastUpdated =
    lastUpdated
      ? lastUpdated.toLocaleTimeString(
          "en-ZA",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        )
      : "";

  // =======================================================
  // CURRENT WEATHER
  // =======================================================

  const currentWeather =
    weather?.current;

  const currentWeatherInfo =
    currentWeather
      ? getWeatherInfo(
          currentWeather.description
        )
      : null;

  const CurrentWeatherIcon =
    currentWeatherInfo?.icon || CloudSun;

  // =======================================================
  // RETURN
  // =======================================================

  return (
    <div className="weather-page" data-theme={theme}>

      {/* =================================================
          HEADER
      ================================================= */}

      <PageTopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        hero={
          <>
            <p className="page-topbar-eyebrow">
              <CloudSun size={15} />
              Weather &amp; climate
            </p>
            <h1>
              Plan your trip around
              <span> the weather.</span>
            </h1>
            <p>
              Check current conditions and the
              days ahead for cities and towns
              around the world.
            </p>
          </>
        }
      />

      {/* =================================================
          CONTENT
      ================================================= */}

      <main className="weather-content">

        {/* =================================================
            SEARCH
        ================================================= */}

        <section className="weather-search-card">

          <div className="weather-search-heading">

            <div className="weather-search-icon">
              <MapPin size={18} />
            </div>

            <div>
              <span>
                Choose your destination
              </span>

              <strong>
                Where are you travelling?
              </strong>
            </div>

          </div>

          <form
            className="weather-search-form"
            onSubmit={searchLocation}
          >

            <div className="weather-search-input-wrapper">

              <Search size={17} />

              <input
                type="text"
                value={searchCity}
                onChange={(event) => {
                  setSearchCity(
                    event.target.value
                  );

                  setShowLocationResults(
                    false
                  );
                }}
                placeholder="Search any city..."
                maxLength={80}
                aria-label="Search city"
              />

            </div>

            <button
              type="submit"
              className="weather-search-button"
              disabled={loading}
            >

              {loading ? (
                <Loader2
                  size={17}
                  className="weather-spin"
                />
              ) : (
                <Search size={17} />
              )}

              Search

            </button>

          </form>

          {/* LOCATION RESULTS */}

          {showLocationResults &&
            locationResults.length > 0 && (
              <div className="location-results">

                {locationResults.map(
                  (result, index) => (
                    <button
                      type="button"
                      className="location-result"
                      key={`${result.id || result.name}-${index}`}
                      onClick={() =>
                        selectLocation(result)
                      }
                    >

                      <div className="location-result-icon">
                        <MapPin size={16} />
                      </div>

                      <div className="location-result-info">

                        <strong>
                          {result.name}
                        </strong>

                        <span>
                          {[
                            result.admin1,
                            result.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>

                      </div>

                      <ArrowRight size={15} />

                    </button>
                  )
                )}

              </div>
            )}

        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="weather-error">

            <CloudSun size={20} />

            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={refreshWeather}
            >
              Try again
            </button>

          </div>
        )}

        {/* nothing to show yet: no trip with a destination, no search */}
        {!weather && !loading && !error && (
          <div className="weather-error">
            <CloudSun size={20} />
            <span>
              {tripsLoaded && !trip
                ? "Search for a city above - or plan a trip and its weather will open here."
                : "Search for a city above."}
            </span>
          </div>
        )}

        {/* =================================================
            CURRENT WEATHER
        ================================================= */}

        {weather && currentWeather && (
          <section className="current-weather-card">

            <div className="current-weather-background" />

            <div className="current-weather-glow current-weather-glow-one" />
            <div className="current-weather-glow current-weather-glow-two" />

            <div className="current-weather-content">

              {/* TOP */}

              <div className="current-weather-top">

                <div>

                  <span className="weather-card-eyebrow">
                    Today's weather
                  </span>

                  <div className="current-weather-location">

                    <MapPin size={15} />

                    <span>
                      {weather.location.name}
                      {weather.location.admin1
                        ? `, ${weather.location.admin1}`
                        : ""}
                    </span>

                  </div>

                </div>

                <button
                  type="button"
                  className="weather-card-refresh"
                  onClick={refreshWeather}
                  disabled={loading}
                  aria-label="Refresh weather"
                >

                  <RefreshCw
                    size={17}
                    className={
                      loading
                        ? "weather-spin"
                        : ""
                    }
                  />

                </button>

              </div>

              {/* MAIN WEATHER */}

              <div className="current-weather-main">

                <div
                  className={`current-weather-icon ${currentWeatherInfo?.type || "clear"}`}
                >
                  <CurrentWeatherIcon
                    size={62}
                    strokeWidth={1.7}
                  />
                </div>

                <div className="current-weather-temperature">

                  <strong>
                    {Math.round(
                      currentWeather.temp
                    )}
                    <sup>
                      °C
                    </sup>
                  </strong>

                  <span>
                    {currentWeatherInfo.label}
                  </span>

                </div>

              </div>

              {/* DESCRIPTION */}

              <div className="current-weather-description">

                <div>
                  <Thermometer size={16} />
                  Feels like{" "}
                  <strong>
                    {Math.round(
                      currentWeather.feels_like
                    )}
                    °C
                  </strong>
                </div>

                <span>
                  Updated{" "}
                  {formattedLastUpdated}
                  {weather.stale && " - weather service unreachable, showing the last reading"}
                </span>

              </div>

              {/* STATS */}

              <div className="current-weather-stats">

                <div className="current-weather-stat">

                  <div className="weather-stat-icon teal">
                    <Droplets size={17} />
                  </div>

                  <div>
                    <span>
                      Humidity
                    </span>

                    <strong>
                      {
                        currentWeather.humidity
                      }
                      %
                    </strong>
                  </div>

                </div>

                <div className="current-weather-stat">

                  <div className="weather-stat-icon blue">
                    <Wind size={17} />
                  </div>

                  <div>
                    <span>
                      Wind
                    </span>

                    <strong>
                      {kmh(
                        currentWeather.wind_speed
                      )}
                    </strong>
                  </div>

                </div>

                <div className="current-weather-stat">

                  <div className="weather-stat-icon purple">
                    <Umbrella size={17} />
                  </div>

                  <div>
                    <span>
                      Rain so far today
                    </span>

                    <strong>
                      {currentWeather.precipitation_mm != null
                        ? `${currentWeather.precipitation_mm} mm`
                        : "None"}
                    </strong>
                  </div>

                </div>

              </div>

            </div>

            {/* DECORATION */}

            <div className="current-weather-decoration">

              <CloudSun
                size={190}
                strokeWidth={0.7}
              />

            </div>

          </section>
        )}

        {/* =================================================
            FORECAST
        ================================================= */}

        {weather?.forecast?.length > 0 && (
          <section className="forecast-section">

            <div className="section-heading">

              <div>

                <span className="section-eyebrow">
                  Your week ahead
                </span>

                <h2>
                  {weather.forecast.length}-day forecast
                </h2>

              </div>

              <div className="forecast-location-label">

                <MapPin size={14} />

                {weather.location.name}

              </div>

            </div>

            <div className="forecast-grid">

              {weather.forecast.map(
                (day, index) => {

                  const dayInfo =
                    getWeatherInfo(
                      day.description
                    );

                  const DayIcon =
                    dayInfo.icon;

                  // the forecast is midday readings only, so after 12:00 UTC
                  // the first entry is tomorrow - compare dates, not position
                  const isToday =
                    day.date === new Date().toLocaleDateString("en-CA");

                  return (
                    <article
                      className={`forecast-card ${
                        isToday
                          ? "today"
                          : ""
                      }`}
                      key={`${day.date}-${index}`}
                    >

                      {isToday && (
                        <div className="forecast-today-badge">
                          Today
                        </div>
                      )}

                      <div className="forecast-date">

                        <strong>
                          {/* the badge above already says Today */}
                          {getDayName(day.date)}
                        </strong>

                        <span>
                          {getShortDate(
                            day.date
                          )}
                        </span>

                      </div>

                      <div
                        className={`forecast-icon ${dayInfo.type}`}
                      >
                        <DayIcon
                          size={30}
                          strokeWidth={1.8}
                        />
                      </div>

                      <div className="forecast-condition">
                        {dayInfo.label}
                      </div>

                      {/* The forecast carries one midday reading per day, not
                          a high and a low - printing it twice only looked like
                          a range the data cannot support. */}
                      <div className="forecast-temperature">

                        <strong>
                          {Math.round(
                            day.temp
                          )}
                          °
                        </strong>

                        <span className="forecast-temperature-note">
                          midday
                        </span>

                      </div>

                      <div className="forecast-rain">

                        <Droplets size={12} />

                        <span>
                          {day.precipitation_chance != null
                            ? `${day.precipitation_chance}% rain`
                            : "No rain data"}
                        </span>

                      </div>

                      <div className="forecast-wind">

                        <Wind size={12} />

                        <span>
                          {day.wind_speed != null
                            ? kmh(day.wind_speed)
                            : "No wind data"}
                        </span>

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          </section>
        )}

        {/* =================================================
            HISTORY, BEST TIME TO VISIT, ADVICE
        ================================================= */}

        {weather?.location && (
          <section className="weather-insights">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">Know before you go</span>
                <h2>Climate, best time &amp; advice for {weather.location.name}</h2>
              </div>
            </div>
            <ClimateInsights
              name={weather.location.name}
              country={weather.location.country}
              latitude={weather.location.latitude}
              longitude={weather.location.longitude}
              forecast={weather.forecast}
              month={location === tripPlace && trip?.startDate ? new Date(trip.startDate).getUTCMonth() + 1 : undefined}
            />
          </section>
        )}

        {/* =================================================
            TRAVEL TIP
        ================================================= */}

        <section className="weather-tip">

          <div className="weather-tip-icon">
            <Umbrella size={19} />
          </div>

          <div className="weather-tip-content">

            <span className="section-eyebrow">
              Roamio travel tip
            </span>

            <strong>
              Check the forecast before
              planning your day.
            </strong>

            <p>
              Weather can change quickly.
              Keep a flexible plan and pack
              accordingly for
              your trip.
            </p>

          </div>

          <div className="weather-tip-decoration">
            <Plane
              size={72}
              strokeWidth={1}
            />
          </div>

        </section>

      </main>

    </div>
  );
}