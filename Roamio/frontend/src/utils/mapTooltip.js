// Leaflet parses strings as HTML. Supply a text-only DOM node for trip fields.
export function createMapTooltip(day, stop, documentApi = document) {
  const node = documentApi.createElement('span');
  node.textContent = `Day ${day.dayNumber} · ${stop.startTime} · ${stop.landmark.name}`;
  return node;
}
