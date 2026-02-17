import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, betweenIso, withinCircle } from "@/lib/soda/query-builders";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, toNumber, unavailableModule } from "@/lib/modules/helpers";

interface CountRow {
  count: string;
}

interface ComplaintTypeRow {
  complaint_type?: string;
  count?: string;
}

function datasetWarning(datasetId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return `${datasetId}: ${message}`;
}

function minusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export async function build311Module(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["erm2-nwe9"]);
  const methodology = `within ${context.radiusSecondaryM}m; top complaint types from last 30 days; delta vs prior 30 days`;

  try {
    const currentWhere = andClauses(
      withinCircle("location", context.location.lat, context.location.lon, context.radiusSecondaryM),
      betweenIso("created_date", context.window30dIso),
    );

    const priorStart = minusDays(context.window30dIso, 30);
    const priorWhere = andClauses(
      withinCircle("location", context.location.lat, context.location.lon, context.radiusSecondaryM),
      betweenIso("created_date", priorStart, context.window30dIso),
    );

    const currentKey = `erm2-nwe9:${context.blockKey}:current:${context.window30dIso}`;
    const priorKey = `erm2-nwe9:${context.blockKey}:prior:${priorStart}:${context.window30dIso}`;
    const topKey = `erm2-nwe9:${context.blockKey}:top:${context.window30dIso}`;

    const results = await Promise.allSettled([
      memoryCache.getOrSet(currentKey, 900, () =>
        sodaFetch<CountRow>("erm2-nwe9", {
          select: "count(*) as count",
          where: currentWhere,
          limit: 1,
        }),
      ),
      memoryCache.getOrSet(priorKey, 900, () =>
        sodaFetch<CountRow>("erm2-nwe9", {
          select: "count(*) as count",
          where: priorWhere,
          limit: 1,
        }),
      ),
      memoryCache.getOrSet(topKey, 900, () =>
        sodaFetch<ComplaintTypeRow>("erm2-nwe9", {
          select: "complaint_type, count(*) as count",
          where: currentWhere,
          group: "complaint_type",
          order: "count(*) DESC",
          limit: 5,
        }),
      ),
    ]);

    if (results.every((result) => result.status === "rejected")) {
      return unavailableModule(
        "311_pulse",
        "311 request data is temporarily unavailable.",
        sources,
        methodology,
        results
          .map((result) => (result.status === "rejected" ? datasetWarning("erm2-nwe9", result.reason) : undefined))
          .filter(Boolean)
          .join(" | "),
      );
    }

    const warnings: string[] = [];
    const currentRows = results[0].status === "fulfilled" ? results[0].value : [];
    if (results[0].status === "rejected") {
      warnings.push(datasetWarning("erm2-nwe9", results[0].reason));
    }

    const priorRows = results[1].status === "fulfilled" ? results[1].value : [];
    if (results[1].status === "rejected") {
      warnings.push(datasetWarning("erm2-nwe9", results[1].reason));
    }

    const topRows = results[2].status === "fulfilled" ? results[2].value : [];
    if (results[2].status === "rejected") {
      warnings.push(datasetWarning("erm2-nwe9", results[2].reason));
    }

    const currentCount = toNumber(currentRows[0]?.count);
    const priorCount = toNumber(priorRows[0]?.count);
    const delta = currentCount - priorCount;

    const topComplaint = topRows[0]?.complaint_type ?? "No dominant type";

    const moduleCard = moduleSkeleton(
      "311_pulse",
      currentCount > 0
        ? `${currentCount} recent 311 requests were filed nearby in the last 30 days.`
        : "No 311 requests were found in this radius during the last 30 days.",
      sources,
      methodology,
      warnings.length ? "partial" : "ok",
    );

    moduleCard.stats = [
      { label: "Requests (30d)", value: currentCount, delta },
      { label: "Prior period", value: priorCount },
      { label: "Top issue", value: topComplaint },
    ];

    moduleCard.items = topRows.map((row) => ({
      title: row.complaint_type || "Unknown issue",
      subtitle: `${toNumber(row.count)} requests`,
      source_dataset_id: "erm2-nwe9",
    }));

    if (warnings.length > 0) {
      moduleCard.warnings = warnings;
    }

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "311_pulse",
      "311 request data is temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const pulse311Module: ModuleBuilder = {
  id: "311_pulse",
  build: build311Module,
};
