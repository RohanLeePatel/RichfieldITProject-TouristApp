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

import ClimateInsights from "../components/insights/ClimateInsights.jsx";
import { fetchWeather as fetchWeatherFromApi } from "../api/weather";
import "../styles/Weather.css";

// =========================================================
// API
// =========================================================

const GEOCODING_API =
  "https://geocoding-api.open-meteo.com/v1/search";

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
      setError("Enter a destination to search for weather.");
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
    fetchWeather(location);
  };

  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {
    fetchWeather(DEFAULT_LOCATION);
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
          currentWeather.description
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
            towns around the world.
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
                placeholder="Search any city..."
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
                      {Math.round(
                        currentWeather.wind_speed
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
                      Weather data unavailable
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

              {weather.forecast.map(
                (day, index) => {

                  const dayInfo =
                    getWeatherInfo(
                      day.description
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
                      key={`${day.date}-${index}`}
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
                                day.date
                              )}
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

                      <div className="forecast-temperature">

                        <strong>
                          {Math.round(
                            day.temp
                          )}
                          °
                        </strong>

                        <span>
                          {Math.round(
                            day.temp
                          )}
                          °
                        </span>

                      </div>

                      <div className="forecast-rain">

                        <Droplets size={12} />

                        <span>
                          Forecast
                        </span>

                      </div>

                      <div className="forecast-wind">

                        <Wind size={12} />

                        <span>
                          data unavailable
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
                <span className="section-eyebrow">KNOW BEFORE YOU GO</span>
                <h2>Climate, best time &amp; advice for {weather.location.name}</h2>
              </div>
            </div>
            <ClimateInsights
              name={weather.location.name}
              country={weather.location.country}
              latitude={weather.location.latitude}
              longitude={weather.location.longitude}
              forecast={weather.forecast}
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