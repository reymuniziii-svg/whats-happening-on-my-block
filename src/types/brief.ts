export type ModuleId =
  | "right_now"
  | "dob_permits"
  | "street_works"
  | "collisions"
  | "311_pulse"
  | "sanitation"
  | "events"
  | "film";

export type ModuleStatus = "ok" | "partial" | "unavailable";

export interface ModuleStat {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
}

export interface ModuleItem {
  title: string;
  subtitle?: string;
  date_start?: string;
  date_end?: string;
  location_desc?: string;
  url?: string;
  source_dataset_id: string;
  raw_id?: string;
  lat?: number;
  lon?: number;
  geometry_wkt?: string;
}

export interface ModuleSource {
  dataset_id: string;
  dataset_name: string;
  dataset_url: string;
}

export interface Module {
  id: ModuleId;
  headline: string;
  status: ModuleStatus;
  stats: ModuleStat[];
  items: ModuleItem[];
  methodology: string;
  sources: ModuleSource[];
  warnings?: string[];
  coverage_note?: string;
}

export interface BriefInput {
  raw_address?: string;
  normalized_address: string;
  geoclient_confidence?: number;
}

export interface BriefLocation {
  lat: number;
  lon: number;
  bbl?: string;
  bin?: string;
  borough?: string;
  community_district?: string;
  council_district?: string;
  zip_code?: string;
}

export interface BriefParameters {
  radius_primary_m: number;
  radius_secondary_m: number;
  window_30d: string;
  window_90d: string;
}

export interface BriefMapFeature {
  id: string;
  module_id: ModuleId;
  kind: "point" | "line";
  label: string;
  coordinates: [number, number][];
}

export interface BriefMapData {
  center: {
    lat: number;
    lon: number;
  };
  radius_primary_m: number;
  radius_secondary_m: number;
  features: BriefMapFeature[];
}

export interface BriefResponse {
  input: BriefInput;
  location: BriefLocation;
  updated_at_utc: string;
  parameters: BriefParameters;
  modules: Module[];
  map: BriefMapData;
}

export interface ResolvedLocation {
  normalized_address: string;
  geocoder: "geoclient" | "geosearch";
  confidence?: number;
  lat: number;
  lon: number;
  bbl?: string;
  bin?: string;
  borough?: string;
  community_district?: string;
  council_district?: string;
  zip_code?: string;
}
