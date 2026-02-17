"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from "react-leaflet";
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
  selectedFeaturePrefix?: string | null;
  onFeatureSelect?: (prefix: string | null) => void;
}

function featurePrefix(featureId: string): string {
  return featureId.replace(/:(point|line)$/, "");
}

function MapClickReset({ onFeatureSelect }: { onFeatureSelect?: (prefix: string | null) => void }) {
  useMapEvents({
    click() {
      onFeatureSelect?.(null);
    },
  });
  return null;
}

export function BriefMap({ map, selectedFeaturePrefix, onFeatureSelect }: BriefMapProps) {
  return (
    <section className="map-panel" aria-label="Map">
      <MapContainer center={[map.center.lat, map.center.lon]} zoom={16} scrollWheelZoom={false} style={{ height: 340, width: "100%" }}>
        <MapClickReset onFeatureSelect={onFeatureSelect} />
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
          const prefix = featurePrefix(feature.id);
          const isSelected = selectedFeaturePrefix === prefix;

          if (feature.kind === "point" && feature.coordinates[0]) {
            return (
              <CircleMarker
                key={feature.id}
                center={feature.coordinates[0]}
                radius={isSelected ? 8 : 6}
                pathOptions={{
                  color: isSelected ? "#bf3f21" : "#1c6f95",
                  fillColor: isSelected ? "#bf3f21" : "#1c6f95",
                  fillOpacity: 0.75,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: (event) => {
                    L.DomEvent.stopPropagation(event.originalEvent);
                    onFeatureSelect?.(prefix);
                  },
                }}
              >
                <Popup>
                  <strong>{feature.label}</strong>
                  <br />
                  Clicked item is linked to the details list.
                </Popup>
              </CircleMarker>
            );
          }

          if (feature.kind === "line" && feature.coordinates.length > 1) {
            return (
              <Polyline
                key={feature.id}
                positions={feature.coordinates}
                pathOptions={{ color: isSelected ? "#bf3f21" : "#ba2d0b", weight: isSelected ? 6 : 3 }}
                eventHandlers={{
                  click: (event) => {
                    L.DomEvent.stopPropagation(event.originalEvent);
                    onFeatureSelect?.(prefix);
                  },
                }}
              >
                <Popup>
                  <strong>{feature.label}</strong>
                  <br />
                  Clicked item is linked to the details list.
                </Popup>
              </Polyline>
            );
          }

          return null;
        })}
      </MapContainer>
    </section>
  );
}
