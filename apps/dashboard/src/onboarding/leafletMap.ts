import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AREA_SHAPE } from "~/onboarding/areaColours";
import type { MapEngine } from "~/onboarding/mapEngine";
import type { SearchArea } from "~/onboarding/types";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const HANDLE = "rounded-pill border-2 border-surface bg-fg";
const METRES_PER_DEGREE = 111_320;

type Drawn = { circle: L.Circle; centre: L.Marker; edge: L.Marker };

function handle(): L.DivIcon {
  return L.divIcon({ className: HANDLE, iconSize: [14, 14] });
}

function eastEdge(circle: L.Circle): L.LatLng {
  const centre = circle.getLatLng();
  const metresPerDegreeLng = METRES_PER_DEGREE * Math.max(Math.cos((centre.lat * Math.PI) / 180), 0.01);
  return L.latLng(centre.lat, centre.lng + circle.getRadius() / metresPerDegreeLng);
}

export const leafletEngine: MapEngine = (element, start, gestures) => {
  const map = L.map(element, { center: [start.lat, start.lng], zoom: 7 });
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
  map.on("click", (event: L.LeafletMouseEvent) => gestures.click({ lat: event.latlng.lat, lng: event.latlng.wrap().lng }));
  let drawn: Drawn[] = [];

  function draw(index: number): Drawn {
    const circle = L.circle([start.lat, start.lng], { radius: 1, className: AREA_SHAPE[index], weight: 2, fillOpacity: 0.15, interactive: false }).addTo(map);
    const centre = L.marker([start.lat, start.lng], { draggable: true, icon: handle(), title: `Move area ${index + 1}` }).addTo(map);
    const edge = L.marker([start.lat, start.lng], { draggable: true, icon: handle(), title: `Resize area ${index + 1}` }).addTo(map);
    centre.on("drag", () => {
      circle.setLatLng(centre.getLatLng());
      edge.setLatLng(eastEdge(circle));
    });
    centre.on("dragend", () => {
      const moved = centre.getLatLng().wrap();
      gestures.move(index, { lat: moved.lat, lng: moved.lng });
    });
    edge.on("drag", () => circle.setRadius(map.distance(circle.getLatLng(), edge.getLatLng())));
    edge.on("dragend", () => gestures.resize(index, circle.getRadius()));
    return { circle, centre, edge };
  }

  return {
    show(areas: SearchArea[]) {
      drawn.splice(areas.length).forEach(({ circle, centre, edge }) => [circle, centre, edge].forEach((layer) => layer.remove()));
      areas.forEach((area, index) => {
        const shape = drawn[index] ?? (drawn[index] = draw(index));
        shape.circle.setLatLng([area.lat, area.lng]);
        shape.circle.setRadius(area.radius_km * 1000);
        shape.centre.setLatLng([area.lat, area.lng]);
        shape.edge.setLatLng(eastEdge(shape.circle));
      });
    },
    destroy() {
      map.remove();
      drawn = [];
    },
  };
};
