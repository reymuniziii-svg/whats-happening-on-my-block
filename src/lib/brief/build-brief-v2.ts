import { DATASETS } from "@/config/datasets";
import { buildBriefWithDiagnostics, type BuildBriefInput, type BuilderRegistry } from "@/lib/brief/build-brief";
import type { Module } from "@/types/brief";
import type { BriefResponseV2, ModuleFreshness } from "@/types/brief-v2";

function moduleRefreshSeconds(moduleData: Module): number {
  const ttls = moduleData.sources
    .map((source) => DATASETS[source.dataset_id as keyof typeof DATASETS]?.ttlSeconds)
    .filter((value): value is number => Number.isFinite(value) && value > 0);

  if (!ttls.length) {
    return 300;
  }

  return Math.min(...ttls);
}

function moduleFreshness(moduleData: Module, refreshedAtUtc: string): ModuleFreshness {
  const revalidateSeconds = moduleRefreshSeconds(moduleData);
  const refreshed = new Date(refreshedAtUtc);
  const nextRefresh = new Date(refreshed.getTime() + revalidateSeconds * 1000).toISOString();

  return {
    refreshed_at_utc: refreshedAtUtc,
    next_refresh_at_utc: nextRefresh,
    revalidate_seconds: revalidateSeconds,
  };
}

export async function buildBriefV2(input: BuildBriefInput, buildersOverride: BuilderRegistry = {}): Promise<BriefResponseV2> {
  const { brief, diagnostics } = await buildBriefWithDiagnostics(input, buildersOverride);

  const freshness: BriefResponseV2["module_freshness"] = {};
  for (const moduleData of brief.modules) {
    freshness[moduleData.id] = moduleFreshness(moduleData, brief.updated_at_utc);
  }

  return {
    version: "2",
    brief,
    module_freshness: freshness,
    module_fetch_ms: diagnostics.module_fetch_ms,
    data_quality_flags: diagnostics.data_quality_flags,
  };
}
