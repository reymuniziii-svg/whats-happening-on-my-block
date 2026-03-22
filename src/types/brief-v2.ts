import type { BriefResponse, ModuleId } from "@/types/brief";

export interface ModuleFreshness {
  refreshed_at_utc: string;
  next_refresh_at_utc: string;
  revalidate_seconds: number;
}

export interface BriefResponseV2 {
  version: "2";
  brief: BriefResponse;
  module_freshness: Partial<Record<ModuleId, ModuleFreshness>>;
  module_fetch_ms: Partial<Record<ModuleId, number>>;
  data_quality_flags: string[];
}
