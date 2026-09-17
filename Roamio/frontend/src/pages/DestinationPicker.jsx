import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Search,
  MapPin,
  X,
  ArrowRight,
  Plane,
  Check,
  Navigation,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "../styles/DestinationPicker.css";

// =========================================================
// DESTINATIONS
// =========================================================

const destinations = [
  {
    id: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    region: "Western Cape",
    coordinates: [-33.9249, 18.4241],
    image:
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "durban",
    name: "Durban",
    country: "South Africa",
    region: "KwaZulu-Natal",
    coordinates: [-29.8587, 31.0218],
    image:
      "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "kruger",
    name: "Kruger National Park",
    country: "South Africa",
    region: "Mpumalanga & Limpopo",
    coordinates: [-23.9884, 31.5547],
    image:
      "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=700&q=80",
  },
];

// =========================================================
// CUSTOM MAP MARKER
// =========================================================

const createMarkerIcon = (selected = false) =>
  L.divIcon({
    className: "destination-map-marker-wrapper",

    html: `
      <div class="destination-map-marker ${
        selected ? "selected" : ""
      }">
        <span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </span>
      </div>
    `,

    iconSize: selected ? [44, 52] : [38, 46],

    iconAnchor: selected
      ? [22, 48]
      : [19, 42],

    popupAnchor: [0, -40],
  });

// =========================================================
// MAP CONTROLLER
// =========================================================

function MapController({ destination }) {
  const map = useMap();

  useEffect(() => {
    if (!destination) {
      return;
    }

    map.flyTo(destination.coordinates, 6, {
      duration: 0.8,
    });
  }, [destination, map]);

  return null;
}

// =========================================================
// COMPONENT
// =========================================================

export default function DestinationPicker({
  isOpen = true,
  onClose,
  onContinue,
}) {
  const [search, setSearch] = useState("");

  const [selectedDestination, setSelectedDestination] =
    useState(null);

  // Reset temporary picker state whenever it closes.
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setSelectedDestination(null);
    }
  }, [isOpen]);

  const filteredDestinations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return destinations;
    }

    return destinations.filter((destination) => {
      return (
        destination.name
          .toLowerCase()
          .includes(query) ||
        destination.country
          .toLowerCase()
          .includes(query) ||
        destination.region
          .toLowerCase()
          .includes(query)
      );
    });
  }, [search]);

  if (!isOpen) {
    return null;
  }

  // =======================================================
  // SELECT DESTINATION
  // =======================================================

  const handleSelect = (destination) => {
    setSelectedDestination(destination);
  };

  // =======================================================
  // CONTINUE
  // =======================================================

  const handleContinue = () => {
    if (!selectedDestination) {
      return;
    }

    if (onContinue) {
      onContinue(selectedDestination);
    }
  };

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div
      className="destination-picker-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="destination-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="destination-picker-title"
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="destination-picker-header">

          <div className="destination-picker-heading">

            <div
              className="destination-picker-icon"
              aria-hidden="true"
            >
              <Plane size={19} />
            </div>

            <div>

              <span className="destination-eyebrow">
                START YOUR JOURNEY
              </span>

              <h2 id="destination-picker-title">
                Where are you going?
              </h2>

              <p>
                Choose a destination for your next family
                adventure.
              </p>

            </div>

          </div>

          <button
            type="button"
            className="destination-close"
            onClick={onClose}
            aria-label="Close destination picker"
          >
            <X size={20} />
          </button>

        </header>

        {/* =================================================
            BODY
        ================================================= */}

        <div className="destination-picker-body">

          {/* =================================================
              DESTINATION LIST
          ================================================= */}

          <div className="destination-list-panel">

            {/* Search */}

            <div className="destination-search">

              <Search
                size={17}
                aria-hidden="true"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search destinations..."
                aria-label="Search destinations"
                autoFocus
              />

              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}

            </div>

            {/* Heading */}

            <div className="destination-list-heading">

              <div>

                <span>
                  EXPLORE
                </span>

                <strong>
                  Popular destinations
                </strong>

              </div>

              <small>
                {filteredDestinations.length} places
              </small>

            </div>

            {/* Results */}

            <div className="destination-results">

              {filteredDestinations.length === 0 ? (

                <div className="destination-empty">

                  <div className="destination-empty-icon">
                    <MapPin size={22} />
                  </div>

                  <strong>
                    No destinations found
                  </strong>

                  <p>
                    Try searching for another city or
                    country.
                  </p>

                </div>

              ) : (

                filteredDestinations.map(
                  (destination) => {

                    const selected =
                      selectedDestination?.id ===
                      destination.id;

                    return (

                      <button
                        type="button"
                        className={`destination-option ${
                          selected ? "selected" : ""
                        }`}
                        key={destination.id}
                        onClick={() =>
                          handleSelect(destination)
                        }
                        aria-pressed={selected}
                      >

                        <div className="destination-option-image">

                          <img
                            src={destination.image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />

                          {selected && (
                            <span className="destination-selected-check">
                              <Check size={13} />
                            </span>
                          )}

                        </div>

                        <div className="destination-option-info">

                          <strong>
                            {destination.name}
                          </strong>

                          <span>
                            {destination.country}
                          </span>

                        </div>

                        <ArrowRight
                          size={15}
                          className="destination-option-arrow"
                          aria-hidden="true"
                        />

                      </button>

                    );
                  }
                )

              )}

            </div>

          </div>

          {/* =================================================
              MAP
          ================================================= */}

          <div className="destination-map-panel">

            <MapContainer
              center={[-29.5, 25]}
              zoom={5}
              scrollWheelZoom={true}
              zoomControl={false}
              className="destination-map"
            >

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapController
                destination={selectedDestination}
              />

              {destinations.map((destination) => {

                const selected =
                  selectedDestination?.id ===
                  destination.id;

                return (

                  <Marker
                    key={destination.id}
                    position={destination.coordinates}
                    icon={createMarkerIcon(selected)}
                    eventHandlers={{
                      click: () =>
                        handleSelect(destination),
                    }}
                  >

                    <Popup>

                      <div className="map-popup">

                        <strong>
                          {destination.name}
                        </strong>

                        <span>
                          {destination.country}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleSelect(destination)
                          }
                        >
                          Select destination
                        </button>

                      </div>

                    </Popup>

                  </Marker>

                );

              })}

            </MapContainer>

            {/* Map label */}

            <div className="map-floating-label">

              <Navigation size={14} />

              <span>
                Select a place on the map
              </span>

            </div>

            {/* Selected destination */}

            {selectedDestination && (

              <div className="selected-destination-card">

                <div className="selected-destination-image">

                  <img
                    src={selectedDestination.image}
                    alt=""
                  />

                </div>

                <div className="selected-destination-details">

                  <span>
                    SELECTED DESTINATION
                  </span>

                  <strong>
                    {selectedDestination.name}
                  </strong>

                  <small>

                    <MapPin size={11} />

                    {selectedDestination.country}

                  </small>

                </div>

                <div className="selected-destination-check">

                  <Check size={15} />

                </div>

              </div>

            )}

          </div>

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="destination-picker-footer">

          <div className="destination-footer-status">

            {selectedDestination ? (

              <>

                <span className="footer-status-dot" />

                <span>
                  Ready to plan your trip to{" "}
                  <strong>
                    {selectedDestination.name}
                  </strong>
                </span>

              </>

            ) : (

              <>

                <MapPin size={14} />

                <span>
                  Select a destination to continue
                </span>

              </>

            )}

          </div>

          <div className="destination-footer-actions">

            <button
              type="button"
              className="destination-cancel"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="button"
              className="destination-continue"
              disabled={!selectedDestination}
              onClick={handleContinue}
            >
              Continue
              <ArrowRight size={16} />
            </button>

          </div>

        </footer>

      </div>
    </div>
  );
}