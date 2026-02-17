"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import type { BriefMapData } from "@/types/brief";

const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface BriefMapProps {
  map: BriefMapData;
}

export function BriefMap({ map }: BriefMapProps) {
  return (
    <section className="map-panel" aria-label="Map">
      <MapContainer center={[map.center.lat, map.center.lon]} zoom={16} scrollWheelZoom={false} style={{ height: 340, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[map.center.lat, map.center.lon]}>
          <Popup>Query location</Popup>
        </Marker>

        <Circle center={[map.center.lat, map.center.lon]} radius={map.radius_primary_m} pathOptions={{ color: "#0f5c4d", fillOpacity: 0.06 }} />
        <Circle
          center={[map.center.lat, map.center.lon]}
          radius={map.radius_secondary_m}
          pathOptions={{ color: "#d48336", fillOpacity: 0.04 }}
        />

        {map.features.map((feature) => {
          if (feature.kind === "point" && feature.coordinates[0]) {
            return (
              <Marker key={feature.id} position={feature.coordinates[0]}>
                <Popup>{feature.label}</Popup>
              </Marker>
            );
          }

          if (feature.kind === "line" && feature.coordinates.length > 1) {
            return <Polyline key={feature.id} positions={feature.coordinates} pathOptions={{ color: "#ba2d0b", weight: 3 }} />;
          }

          return null;
        })}
      </MapContainer>
    </section>
  );
}
