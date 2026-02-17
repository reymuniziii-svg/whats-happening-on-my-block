import { DEFAULT_PARAMETERS, MODULE_ORDER } from "@/config/modules";
import { collisionsModule } from "@/lib/modules/collisions";
import { dobPermitsModule } from "@/lib/modules/dob-permits";
import { eventsModule } from "@/lib/modules/events";
import { filmModule } from "@/lib/modules/film";
import { pulse311Module } from "@/lib/modules/pulse311";
import { rightNowModule } from "@/lib/modules/right-now";
import { sanitationModule } from "@/lib/modules/sanitation";
import { streetWorksModule } from "@/lib/modules/street-works";
import type { ModuleBuilder, ModuleBuildContext } from "@/lib/modules/types";
import { parseWktLineStringToLatLon, toBlockKey } from "@/lib/utils/geo";
import { daysAgoIso, nowUtcIso } from "@/lib/utils/time";
import type { BriefMapFeature, BriefResponse, Module, ModuleId, ResolvedLocation } from "@/types/brief";

const BUILDERS: Record<string, ModuleBuilder> = {
  right_now: rightNowModule,
  dob_permits: dobPermitsModule,
  street_works: streetWorksModule,
  collisions: collisionsModule,
  "311_pulse": pulse311Module,
  sanitation: sanitationModule,
  events: eventsModule,
  film: filmModule,
};

function moduleFallback(id: Module["id"], error: string): Module {
  return {
    id,
    headline: "This module is temporarily unavailable.",
    status: "unavailable",
    stats: [{ label: "Status", value: "Unavailable" }],
    items: [],
    methodology: "Rendering fallback because one or more datasets failed.",
    sources: [],
    warnings: [error],
  };
}

function collectMapFeatures(modules: Module[]): BriefMapFeature[] {
  const features: BriefMapFeature[] = [];

  for (const moduleData of modules) {
    for (const item of moduleData.items) {
      if (Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
        features.push({
          id: `${moduleData.id}:${item.raw_id ?? item.title}:point`,
          module_id: moduleData.id,
          kind: "point",
          label: item.title,
          coordinates: [[item.lat as number, item.lon as number]],
        });
      }

      if (item.geometry_wkt) {
        const line = parseWktLineStringToLatLon(item.geometry_wkt);
        if (line.length > 1) {
          features.push({
            id: `${moduleData.id}:${item.raw_id ?? item.title}:line`,
            module_id: moduleData.id,
            kind: "line",
            label: item.title,
            coordinates: line,
          });
        }
      }
    }
  }

  return features.slice(0, 200);
}

export interface BuildBriefInput {
  location: ResolvedLocation;
  rawAddress?: string;
}

type BuilderRegistry = Partial<Record<ModuleId, ModuleBuilder>>;

export async function buildBrief(input: BuildBriefInput, buildersOverride: BuilderRegistry = {}): Promise<BriefResponse> {
  const nowIso = nowUtcIso();
  const context: ModuleBuildContext = {
    location: input.location,
    radiusPrimaryM: DEFAULT_PARAMETERS.radius_primary_m,
    radiusSecondaryM: DEFAULT_PARAMETERS.radius_secondary_m,
    window30dIso: daysAgoIso(30),
    window90dIso: daysAgoIso(90),
    window12mIso: daysAgoIso(365),
    nowIso,
    blockKey: toBlockKey(input.location.lat, input.location.lon, input.location.bbl),
  };

  const settled = await Promise.allSettled(
    MODULE_ORDER.map(async (id) => {
      const builder = buildersOverride[id] ?? BUILDERS[id];
      return builder.build(context);
    }),
  );

  const modules: Module[] = settled.map((result, index) => {
    const moduleId = MODULE_ORDER[index];
    if (result.status === "fulfilled") {
      return result.value;
    }
    return moduleFallback(moduleId, result.reason instanceof Error ? result.reason.message : "Unknown error");
  });

  const brief: BriefResponse = {
    input: {
      raw_address: input.rawAddress,
      normalized_address: input.location.normalized_address,
      geoclient_confidence: input.location.confidence,
    },
    location: {
      lat: input.location.lat,
      lon: input.location.lon,
      bbl: input.location.bbl,
      bin: input.location.bin,
      borough: input.location.borough,
      community_district: input.location.community_district,
      council_district: input.location.council_district,
      zip_code: input.location.zip_code,
    },
    updated_at_utc: nowIso,
    parameters: {
      radius_primary_m: DEFAULT_PARAMETERS.radius_primary_m,
      radius_secondary_m: DEFAULT_PARAMETERS.radius_secondary_m,
      window_30d: context.window30dIso,
      window_90d: context.window90dIso,
    },
    modules,
    map: {
      center: {
        lat: input.location.lat,
        lon: input.location.lon,
      },
      radius_primary_m: DEFAULT_PARAMETERS.radius_primary_m,
      radius_secondary_m: DEFAULT_PARAMETERS.radius_secondary_m,
      features: collectMapFeatures(modules),
    },
  };

  return brief;
}
