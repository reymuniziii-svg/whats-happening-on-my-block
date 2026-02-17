import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { pointInPolygon } from "@/lib/soda/query-builders";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, unavailableModule } from "@/lib/modules/helpers";

interface SanitationRow {
  district?: string;
  section?: string;
  freq_refuse?: string;
  freq_recycling?: string;
  freq_organics?: string;
  freq_bulk?: string;
}

async function queryPreferredDataset(lat: number, lon: number): Promise<SanitationRow | null> {
  const where = pointInPolygon("multipolygon", lon, lat);
  const rows = await sodaFetch<SanitationRow>("p7k6-2pm8", {
    select: "district, section, freq_refuse, freq_recycling, freq_organics, freq_bulk",
    where,
    limit: 1,
  });
  if (!rows.length) {
    return null;
  }

  const row = rows[0];
  if (!row.freq_refuse && !row.freq_recycling && !row.freq_organics && !row.freq_bulk) {
    return null;
  }
  return row;
}

async function queryFallbackDataset(lat: number, lon: number): Promise<SanitationRow | null> {
  const where = pointInPolygon("multipolygon", lon, lat);
  const rows = await sodaFetch<SanitationRow>("rv63-53db", {
    select: "district, section, freq_refuse, freq_recycling, freq_organics, freq_bulk",
    where,
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function buildSanitationModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["rv63-53db", "p7k6-2pm8"]);
  const methodology =
    "point-in-polygon boundary match at query location; frequencies represent area-level service patterns, not guaranteed exact pickup day";

  try {
    const cacheKey = `sanitation:${context.blockKey}`;
    const result = await memoryCache.getOrSet(cacheKey, 86_400, async () => {
      const preferred = await queryPreferredDataset(context.location.lat, context.location.lon).catch(() => null);
      if (preferred) {
        return { row: preferred, source: "p7k6-2pm8" as const };
      }
      const fallback = await queryFallbackDataset(context.location.lat, context.location.lon);
      return { row: fallback, source: "rv63-53db" as const };
    });

    const moduleCard = moduleSkeleton(
      "sanitation",
      "Area collection frequencies based on DSNY service boundaries.",
      sources,
      methodology,
      "ok",
    );

    if (!result.row) {
      moduleCard.status = "partial";
      moduleCard.warnings = ["No sanitation boundary match was returned for this location."];
      moduleCard.coverage_note = "Sanitation coverage uses DSNY area frequencies and may miss edge-case points.";
      moduleCard.stats = [{ label: "Status", value: "No boundary match" }];
      return moduleCard;
    }

    moduleCard.stats = [
      { label: "Refuse", value: result.row.freq_refuse ?? "N/A" },
      { label: "Recycling", value: result.row.freq_recycling ?? "N/A" },
      { label: "Organics", value: result.row.freq_organics ?? "N/A" },
      { label: "Bulk", value: result.row.freq_bulk ?? "N/A" },
    ];

    moduleCard.items = [
      {
        title: `District ${result.row.district ?? "Unknown"} Section ${result.row.section ?? "Unknown"}`,
        subtitle: `Source: ${result.source}`,
        source_dataset_id: result.source,
      },
    ];

    if (result.source === "rv63-53db") {
      moduleCard.coverage_note =
        "Primary dataset p7k6-2pm8 is currently sparse via API, so v1 uses DSNY Frequencies (rv63-53db) fallback.";
    }

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "sanitation",
      "Sanitation data is temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const sanitationModule: ModuleBuilder = {
  id: "sanitation",
  build: buildSanitationModule,
};
