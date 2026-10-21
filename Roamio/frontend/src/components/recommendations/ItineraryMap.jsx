import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const dayColor = (dayNumber) => `var(--day-${((dayNumber - 1) % 6) + 1})`;
const dayClass = (dayNumber) => `day-${((dayNumber - 1) % 6) + 1}`;
const hasCoords = (stop) => Number.isFinite(stop.landmark.lat) && Number.isFinite(stop.landmark.lon);

// Real map: Leaflet + OpenStreetMap tiles - free, no API key. OSM's public tile
// server is for light use; for production traffic swap the tile URL below for a
// hosted provider (or self-host tiles). Pins are numbered by visiting order and
// each day's stops are joined by a dashed route in that day's colour.
export default function ItineraryMap({ itineraryDays }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const days = itineraryDays.filter((day) => day.stops.some(hasCoords));

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.featureGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [days.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // redraw pins/routes whenever the itinerary changes (drag, remove, add day)
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    days.forEach((day) => {
      const stops = day.stops.filter(hasCoords);
      L.polyline(stops.map((s) => [s.landmark.lat, s.landmark.lon]), {
        className: `map-route ${dayClass(day.dayNumber)}`,
        weight: 3,
        dashArray: "7 6",
      }).addTo(layer);
      stops.forEach((stop, index) => {
        L.marker([stop.landmark.lat, stop.landmark.lon], {
          icon: L.divIcon({
            className: "map-pin-icon",
            html: `<span class="map-pin-dot" style="background:${dayColor(day.dayNumber)}">${index + 1}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
          title: `Day ${day.dayNumber}, stop ${index + 1}: ${stop.landmark.name}`,
        })
          .bindTooltip(`Day ${day.dayNumber} · ${stop.startTime} · ${stop.landmark.name}`)
          .addTo(layer);
      });
    });
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  }, [itineraryDays]); // eslint-disable-line react-hooks/exhaustive-deps

  if (days.length === 0) return null;

  return (
    <div className="itinerary-map">
      <div ref={containerRef} className="itinerary-map-canvas" role="region" aria-label="Map of itinerary stops by day" />
      <div className="itinerary-map-legend">
        {days.map((day) => (
          <span key={day.dayNumber}>
            <i style={{ background: dayColor(day.dayNumber) }} />
            Day {day.dayNumber} · {day.stops.length} stop{day.stops.length === 1 ? "" : "s"}
          </span>
        ))}
        <small>Numbers show visiting order. Click the map, then scroll to zoom.</small>
      </div>
    </div>
  );
}
