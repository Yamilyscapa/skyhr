import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Tooltip,
  useMapEvents,
} from "react-leaflet";

export interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function GeofenceMap({
  locations,
  center,
  draft,
  onMapClick,
}: {
  locations: MapLocation[];
  center: [number, number];
  draft?: { lat: number; lng: number; radius: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full"
      style={{ minHeight: 320 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />

      {locations.map((loc) => (
        <Circle
          key={loc.id}
          center={[loc.lat, loc.lng]}
          radius={loc.radius}
          pathOptions={{ color: "#7c93ff", fillColor: "#7c93ff", fillOpacity: 0.15 }}
        >
          <CircleMarker
            center={[loc.lat, loc.lng]}
            radius={5}
            pathOptions={{ color: "#7c93ff", fillColor: "#7c93ff", fillOpacity: 1 }}
          />
          <Tooltip>{loc.name}</Tooltip>
        </Circle>
      ))}

      {draft && (
        <Circle
          center={[draft.lat, draft.lng]}
          radius={draft.radius}
          pathOptions={{
            color: "#34d399",
            fillColor: "#34d399",
            fillOpacity: 0.2,
            dashArray: "6 6",
          }}
        >
          <CircleMarker
            center={[draft.lat, draft.lng]}
            radius={5}
            pathOptions={{ color: "#34d399", fillColor: "#34d399", fillOpacity: 1 }}
          />
        </Circle>
      )}
    </MapContainer>
  );
}
