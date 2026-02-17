"use client";

import dynamic from "next/dynamic";
import type { BriefMapData } from "@/types/brief";

interface MapPanelProps {
  map: BriefMapData;
  selectedFeaturePrefix?: string | null;
  onFeatureSelect?: (prefix: string | null) => void;
}

const DynamicBriefMap = dynamic(() => import("@/components/BriefMap").then((mod) => mod.BriefMap), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map...</div>,
});

export function MapPanel({ map, selectedFeaturePrefix, onFeatureSelect }: MapPanelProps) {
  return (
    <section>
      <DynamicBriefMap map={map} selectedFeaturePrefix={selectedFeaturePrefix} onFeatureSelect={onFeatureSelect} />
      <div className="map-legend" aria-label="Map legend">
        <span>Pin: your query location</span>
        <span>Green ring: {map.radius_primary_m}m</span>
        <span>Orange ring: {map.radius_secondary_m}m</span>
        <span>Lines/dots: mapped dataset records</span>
      </div>
      {selectedFeaturePrefix ? <p className="map-selection-note">Linked highlight is active from the details list or map.</p> : null}
    </section>
  );
}
