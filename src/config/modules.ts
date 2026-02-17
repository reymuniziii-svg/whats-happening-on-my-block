import type { ModuleId } from "@/types/brief";

export const MODULE_ORDER: ModuleId[] = [
  "right_now",
  "dob_permits",
  "street_works",
  "collisions",
  "311_pulse",
  "sanitation",
  "events",
  "film",
];

export const DEFAULT_PARAMETERS = {
  radius_primary_m: 150,
  radius_secondary_m: 400,
  cluster_radius_m: 75,
  limit_items: 12,
} as const;
