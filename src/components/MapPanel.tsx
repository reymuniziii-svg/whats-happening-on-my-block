"use client";

import dynamic from "next/dynamic";
import type { BriefMapData } from "@/types/brief";

interface MapPanelProps {
  map: BriefMapData;
}

const DynamicBriefMap = dynamic(() => import("@/components/BriefMap").then((mod) => mod.BriefMap), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map...</div>,
});

export function MapPanel({ map }: MapPanelProps) {
  return (
    <section>
      <DynamicBriefMap map={map} />
      <div className="map-legend" aria-label="Map legend">
        <span>Pin: your query location</span>
        <span>Green ring: {map.radius_primary_m}m</span>
        <span>Orange ring: {map.radius_secondary_m}m</span>
        <span>Lines/dots: mapped dataset records</span>
      </div>
    </section>
  );
}
