import {
  ArrowLeft,
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
import { Link } from "react-router-dom";

import "../styles/weather.css";

// =========================================================
// API
// =========================================================

const GEOCODING_API =
  "https://geocoding-api.open-meteo.com/v1/search";

const WEATHER_API =
  "https://api.open-meteo.com/v1/forecast";

// =========================================================
// DEFAULT LOCATION
// =========================================================

const DEFAULT_LOCATION = {
  name: "Durban",
  country: "South Africa",
  countryCode: "ZA",
  admin1: "KwaZulu-Natal",
  latitude: -29.8587,
  longitude: 31.0218,
};

// =========================================================
// WEATHER HELPER
// =========================================================

function getWeatherInfo(weatherCode) {
  if (weatherCode === 0) {
    return {
      label: "Clear sky",
      icon: Sun,
      type: "clear",
    };
  }

  if (weatherCode === 1) {
    return {
      label: "Mainly clear",
      icon: Sun,
      type: "clear",
    };
  }

  if (weatherCode === 2) {
    return {
      label: "Partly cloudy",
      icon: CloudSun,
      type: "cloud",
    };
  }

  if (weatherCode === 3) {
    return {
      label: "Overcast",
      icon: Cloud,
      type: "cloud",
    };
  }

  if ([45, 48].includes(weatherCode)) {
    return {
      label: "Foggy",
      icon: Cloud,
      type: "cloud",
    };
  }

  if ([51, 53, 55].includes(weatherCode)) {
    return {
      label: "Drizzle",
      icon: CloudRain,
      type: "rain",
    };
  }

  if ([56, 57].includes(weatherCode)) {
    return {
      label: "Freezing drizzle",
      icon: CloudRain,
      type: "rain",
    };
  }

  if ([61, 63, 65].includes(weatherCode)) {
    return {
      label: "Rain",
      icon: CloudRain,
      type: "rain",
    };
  }

  if ([66, 67].includes(weatherCode)) {
    return {
      label: "Freezing rain",
      icon: CloudRain,
      type: "rain",
    };
  }

  if ([71, 73, 75].includes(weatherCode)) {
    return {
      label: "Snow",
      icon: Cloud,
      type: "snow",
    };
  }

  if (weatherCode === 77) {
    return {
      label: "Snow grains",
      icon: Cloud,
      type: "snow",
    };
  }

  if ([80, 81, 82].includes(weatherCode)) {
    return {
      label: "Rain showers",
      icon: CloudRain,
      type: "rain",
    };
  }

  if ([85, 86].includes(weatherCode)) {
    return {
      label: "Snow showers",
      icon: Cloud,
      type: "snow",
    };
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return {
      label: "Thunderstorm",
      icon: CloudRain,
      type: "storm",
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

  return date.toLocaleDateString("en-ZA", {
    weekday: "short",
  });
};

const getShortDate = (dateString) => {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
};

// =========================================================
// WEATHER PAGE
// =========================================================

export default function Weather() {
  // =======================================================
  // STATE
  // =======================================================

  const [searchCity, setSearchCity] =
    useState(DEFAULT_LOCATION.name);

  const [location, setLocation] =
    useState(DEFAULT_LOCATION);

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

  const fetchWeather = async (
    latitude,
    longitude,
    locationData = location
  ) => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        latitude,
        longitude,

        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",

        daily:
          "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset",

        timezone: "auto",

        forecast_days: "7",
      });

      const response = await fetch(
        `${WEATHER_API}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(
          "Weather request failed."
        );
      }

      const data = await response.json();

      setWeather({
        ...data,
        location: locationData,
      });

      setLastUpdated(new Date());
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

      const southAfricanResults =
        (data.results || []).filter(
          (item) =>
            item.country_code === "ZA"
        );

      if (!southAfricanResults.length) {
        setLocationResults([]);
        setError(
          "No South African location was found. Try another city or town."
        );
        return;
      }

      setLocationResults(
        southAfricanResults
      );

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
        result.country || "South Africa",
      countryCode:
        result.country_code || "ZA",
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

    fetchWeather(
      selectedLocation.latitude,
      selectedLocation.longitude,
      selectedLocation
    );
  };

  // =======================================================
  // REFRESH
  // =======================================================

  const refreshWeather = () => {
    fetchWeather(
      location.latitude,
      location.longitude,
      location
    );
  };

  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {
    fetchWeather(
      DEFAULT_LOCATION.latitude,
      DEFAULT_LOCATION.longitude,
      DEFAULT_LOCATION
    );
  }, []);

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
          currentWeather.weather_code
        )
      : null;

  const CurrentWeatherIcon =
    currentWeatherInfo?.icon || CloudSun;

  // =======================================================
  // RETURN
  // =======================================================

  return (
    <div className="weather-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="weather-header">

        <div className="weather-brand">

          <div className="weather-logo">
            <Plane
              size={19}
              strokeWidth={2.2}
            />
          </div>

          <div className="weather-brand-text">

            <h2>
              Roamio
            </h2>

            <span>
              Adventures together
            </span>

          </div>

        </div>

        <Link
          to="/dashboard"
          className="weather-back-button"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

      </header>

      {/* =================================================
          CONTENT
      ================================================= */}

      <main className="weather-content">

        {/* =================================================
            INTRO
        ================================================= */}

        <section className="weather-intro">

          <div className="weather-page-badge">
            <CloudSun size={14} />
            SOUTH AFRICA WEATHER
          </div>

          <h1>
            Plan your trip around
            <span> the weather.</span>
          </h1>

          <p>
            Check current conditions and
            the 7-day forecast for cities and
            towns across South Africa.
          </p>

        </section>

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
                CHOOSE YOUR DESTINATION
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
                placeholder="Search a South African city..."
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
                    TODAY'S WEATHER
                  </span>

                  <div className="current-weather-location">

                    <MapPin size={15} />

                    <span>
                      {location.name}
                      {location.admin1
                        ? `, ${location.admin1}`
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
                      currentWeather.temperature_2m
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
                      currentWeather.apparent_temperature
                    )}
                    °C
                  </strong>
                </div>

                <span>
                  Updated{" "}
                  {formattedLastUpdated}
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
                        currentWeather.relative_humidity_2m
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
                      {Math.round(
                        currentWeather.wind_speed_10m
                      )}{" "}
                      km/h
                    </strong>
                  </div>

                </div>

                <div className="current-weather-stat">

                  <div className="weather-stat-icon purple">
                    <Umbrella size={17} />
                  </div>

                  <div>
                    <span>
                      Precipitation
                    </span>

                    <strong>
                      {
                        currentWeather.precipitation
                      }{" "}
                      mm
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

        {weather?.daily && (
          <section className="forecast-section">

            <div className="section-heading">

              <div>

                <span className="section-eyebrow">
                  YOUR WEEK AHEAD
                </span>

                <h2>
                  7-day forecast
                </h2>

              </div>

              <div className="forecast-location-label">

                <MapPin size={14} />

                {location.name}

              </div>

            </div>

            <div className="forecast-grid">

              {weather.daily.time.map(
                (date, index) => {

                  const dayInfo =
                    getWeatherInfo(
                      weather.daily
                        .weather_code[index]
                    );

                  const DayIcon =
                    dayInfo.icon;

                  const isToday =
                    index === 0;

                  return (
                    <article
                      className={`forecast-card ${
                        isToday
                          ? "today"
                          : ""
                      }`}
                      key={date}
                    >

                      {isToday && (
                        <div className="forecast-today-badge">
                          TODAY
                        </div>
                      )}

                      <div className="forecast-date">

                        <strong>
                          {isToday
                            ? "Today"
                            : getDayName(
                                date
                              )}
                        </strong>

                        <span>
                          {getShortDate(
                            date
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

                      <div className="forecast-temperature">

                        <strong>
                          {Math.round(
                            weather.daily
                              .temperature_2m_max[
                              index
                            ]
                          )}
                          °
                        </strong>

                        <span>
                          {Math.round(
                            weather.daily
                              .temperature_2m_min[
                              index
                            ]
                          )}
                          °
                        </span>

                      </div>

                      <div className="forecast-rain">

                        <Droplets size={12} />

                        <span>
                          {weather.daily
                            .precipitation_probability_max[
                            index
                          ] ?? 0}
                          %
                        </span>

                      </div>

                      <div className="forecast-wind">

                        <Wind size={12} />

                        <span>
                          {Math.round(
                            weather.daily
                              .wind_speed_10m_max[
                              index
                            ]
                          )}{" "}
                          km/h
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
            TRAVEL TIP
        ================================================= */}

        <section className="weather-tip">

          <div className="weather-tip-icon">
            <Umbrella size={19} />
          </div>

          <div className="weather-tip-content">

            <span className="section-eyebrow">
              ROAMIO TRAVEL TIP
            </span>

            <strong>
              Check the forecast before
              planning your day.
            </strong>

            <p>
              Weather can change quickly.
              Keep a flexible plan and pack
              accordingly for your family's
              adventure.
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