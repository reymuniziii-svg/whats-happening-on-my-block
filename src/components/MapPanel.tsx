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
  return <DynamicBriefMap map={map} />;
}
