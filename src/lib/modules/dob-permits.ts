import { memoryCache } from "@/lib/cache/memory-cache";
import { sodaFetch } from "@/lib/soda/client";
import { andClauses, betweenIso, binPredicate, compareIso, timestampLiteral } from "@/lib/soda/query-builders";
import { bboxForRadius, haversineMeters } from "@/lib/utils/geo";
import type { Module } from "@/types/brief";
import type { ModuleBuildContext, ModuleBuilder } from "@/lib/modules/types";
import { moduleSkeleton, moduleSources, toNumber, unavailableModule } from "@/lib/modules/helpers";

interface DobPermitIssuanceRow {
  permit_si_no?: string;
  work_type?: string;
  issuance_date?: string;
  house__?: string;
  street_name?: string;
  permittee_s_business_name?: string;
  gis_latitude?: string;
  gis_longitude?: string;
}

interface DobNowPermitRow {
  tracking_number?: string;
  work_type?: string;
  issued_date?: string;
  latitude?: string;
  longitude?: string;
  street_name?: string;
  house_no?: string;
  permit_status?: string;
}

interface ComplaintCountRow {
  complaint_category?: string;
  status?: string;
  count?: string;
}

interface ViolationAggregateRow {
  count?: string;
  latest?: string;
}

interface ViolationEntityRow {
  respondent_name?: string;
  count?: string;
}

function datasetWarning(datasetId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return `${datasetId}: ${message}`;
}

function splitBbl(bbl?: string): { block?: string; lot?: string } {
  if (!bbl) {
    return {};
  }
  const digits = bbl.replace(/\D/g, "");
  if (digits.length !== 10) {
    return {};
  }
  return {
    block: digits.slice(1, 6),
    lot: digits.slice(6),
  };
}

function parseMmDdYyyy(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const [m, d, y] = value.split("/").map((part) => Number(part));
  if (!m || !d || !y) {
    return undefined;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function countBy<T>(items: T[], keySelector: (item: T) => string | undefined): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keySelector(item)?.trim();
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export async function buildDobPermitsModule(context: ModuleBuildContext): Promise<Module> {
  const sources = moduleSources(["ipu4-2q9a", "rbx6-tga4", "eabe-havv", "6bgk-3dad"]);
  const methodology =
    "last 90 days for permits/complaints, last 12 months for ECB violations; radius match where geometry exists and BIN/BBL fallback for non-geocoded datasets";

  try {
    const bbox = bboxForRadius(context.location.lat, context.location.lon, context.radiusSecondaryM);

    const permitWhere = andClauses(
      `issuance_date::floating_timestamp >= ${timestampLiteral(context.window90dIso)}`,
      `gis_latitude::number between ${bbox.minLat} and ${bbox.maxLat}`,
      `gis_longitude::number between ${bbox.minLon} and ${bbox.maxLon}`,
    );

    const permitNowWhere = andClauses(
      betweenIso("issued_date", context.window90dIso),
      `latitude between ${bbox.minLat} and ${bbox.maxLat}`,
      `longitude between ${bbox.minLon} and ${bbox.maxLon}`,
    );

    const complaintWhere = andClauses(
      compareIso("date_entered", ">=", context.window90dIso),
      binPredicate("bin", context.location.bin),
    );

    const window12mDate = new Date(context.window12mIso);
    const threshold12m = `${window12mDate.getUTCFullYear()}${String(window12mDate.getUTCMonth() + 1).padStart(2, "0")}${String(
      window12mDate.getUTCDate(),
    ).padStart(2, "0")}`;
    const split = splitBbl(context.location.bbl);
    const violationWhere = andClauses(
      `issue_date >= '${threshold12m}'`,
      split.block ? `block='${split.block}'` : undefined,
      split.lot ? `lot='${split.lot}'` : undefined,
      binPredicate("bin", context.location.bin),
    );

    const results = await Promise.allSettled([
      memoryCache.getOrSet(`ipu4-2q9a:${context.blockKey}:${context.window90dIso}`, 900, () =>
        sodaFetch<DobPermitIssuanceRow>("ipu4-2q9a", {
          select:
            "permit_si_no, work_type, issuance_date, house__, street_name, permittee_s_business_name, gis_latitude, gis_longitude",
          where: permitWhere,
          order: "issuance_date DESC",
          limit: 900,
        }),
      ),
      memoryCache.getOrSet(`rbx6-tga4:${context.blockKey}:${context.window90dIso}`, 900, () =>
        sodaFetch<DobNowPermitRow>("rbx6-tga4", {
          select: "tracking_number, work_type, issued_date, latitude, longitude, street_name, house_no, permit_status",
          where: permitNowWhere,
          order: "issued_date DESC",
          limit: 900,
        }),
      ),
      complaintWhere
        ? memoryCache.getOrSet(`eabe-havv:${context.blockKey}:${context.window90dIso}`, 900, () =>
            sodaFetch<ComplaintCountRow>("eabe-havv", {
              select: "complaint_category, status, count(*) as count",
              where: complaintWhere,
              group: "complaint_category, status",
              order: "count(*) DESC",
              limit: 40,
            }),
          )
        : Promise.resolve([] as ComplaintCountRow[]),
      violationWhere
        ? memoryCache.getOrSet(`6bgk-3dad:${context.blockKey}:${threshold12m}`, 900, () =>
            sodaFetch<ViolationAggregateRow>("6bgk-3dad", {
              select: "count(*) as count, max(issue_date) as latest",
              where: violationWhere,
              limit: 1,
            }),
          )
        : Promise.resolve([] as ViolationAggregateRow[]),
      violationWhere
        ? memoryCache.getOrSet(`6bgk-3dad:entities:${context.blockKey}:${threshold12m}`, 900, () =>
            sodaFetch<ViolationEntityRow>("6bgk-3dad", {
              select: "respondent_name, count(*) as count",
              where: violationWhere,
              group: "respondent_name",
              order: "count(*) DESC",
              limit: 3,
            }),
          )
        : Promise.resolve([] as ViolationEntityRow[]),
    ]);

    if (results.every((result) => result.status === "rejected")) {
      return unavailableModule(
        "dob_permits",
        "DOB permit and complaint data is temporarily unavailable.",
        sources,
        methodology,
        results
          .map((result) => (result.status === "rejected" ? datasetWarning("dob", result.reason) : undefined))
          .filter(Boolean)
          .join(" | "),
      );
    }

    const moduleWarnings: string[] = [];

    const issuanceRows = results[0].status === "fulfilled" ? results[0].value : [];
    if (results[0].status === "rejected") {
      moduleWarnings.push(datasetWarning("ipu4-2q9a", results[0].reason));
    }

    const nowRows = results[1].status === "fulfilled" ? results[1].value : [];
    if (results[1].status === "rejected") {
      moduleWarnings.push(datasetWarning("rbx6-tga4", results[1].reason));
    }

    const complaintRows = results[2].status === "fulfilled" ? results[2].value : [];
    if (results[2].status === "rejected") {
      moduleWarnings.push(datasetWarning("eabe-havv", results[2].reason));
    }

    const violationAggRows = results[3].status === "fulfilled" ? results[3].value : [];
    if (results[3].status === "rejected") {
      moduleWarnings.push(datasetWarning("6bgk-3dad", results[3].reason));
    }

    const violationEntities = results[4].status === "fulfilled" ? results[4].value : [];
    if (results[4].status === "rejected") {
      moduleWarnings.push(datasetWarning("6bgk-3dad", results[4].reason));
    }

    const issuanceFiltered = issuanceRows.filter((row) => {
      const lat = Number(row.gis_latitude);
      const lon = Number(row.gis_longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return false;
      }
      return haversineMeters(context.location.lat, context.location.lon, lat, lon) <= context.radiusSecondaryM;
    });

    const nowFiltered = nowRows.filter((row) => {
      const lat = Number(row.latitude);
      const lon = Number(row.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return false;
      }
      return haversineMeters(context.location.lat, context.location.lon, lat, lon) <= context.radiusSecondaryM;
    });

    const workTypeCounts = countBy([...issuanceFiltered, ...nowFiltered], (row) => (row as { work_type?: string }).work_type);
    const topWorkType = workTypeCounts[0]?.key ?? "N/A";

    const complaintsTotal = complaintRows.reduce((sum, row) => sum + toNumber(row.count), 0);
    const openComplaints = complaintRows
      .filter((row) => row.status?.toLowerCase().includes("open"))
      .reduce((sum, row) => sum + toNumber(row.count), 0);

    const violationsTotal = toNumber(violationAggRows[0]?.count);
    const latestViolation = violationAggRows[0]?.latest;

    const moduleCard = moduleSkeleton(
      "dob_permits",
      issuanceFiltered.length + nowFiltered.length > 0
        ? `${issuanceFiltered.length + nowFiltered.length} DOB permits were issued/approved nearby in the last 90 days.`
        : "No recent DOB permit activity was found within the selected radius.",
      sources,
      methodology,
      moduleWarnings.length ? "partial" : "ok",
    );

    moduleCard.stats = [
      { label: "DOB permits (90d)", value: issuanceFiltered.length + nowFiltered.length },
      { label: "Top work type", value: topWorkType },
      { label: "DOB complaints (90d)", value: complaintsTotal },
      { label: "ECB violations (12m)", value: violationsTotal },
    ];

    moduleCard.items = [
      ...workTypeCounts.slice(0, 3).map((row) => ({
        title: `Work type: ${row.key}`,
        subtitle: `${row.count} permits`,
        source_dataset_id: "ipu4-2q9a" as const,
      })),
      ...complaintRows
        .sort((a, b) => toNumber(b.count) - toNumber(a.count))
        .slice(0, 5)
        .map((row) => ({
          title: `Complaint category ${row.complaint_category ?? "Unknown"}`,
          subtitle: `${toNumber(row.count)} reports (${row.status ?? "unknown status"})`,
          source_dataset_id: "eabe-havv" as const,
        })),
      ...violationEntities.map((row) => ({
        title: row.respondent_name || "Unnamed respondent",
        subtitle: `${toNumber(row.count)} violations in last 12 months`,
        source_dataset_id: "6bgk-3dad" as const,
      })),
      ...issuanceFiltered.slice(0, 4).map((row) => ({
        title: `${row.house__ ?? ""} ${row.street_name ?? ""}`.trim() || "DOB permit",
        subtitle: `${row.work_type ?? "Unknown work type"} · ${row.permittee_s_business_name ?? "Unknown permittee"}`,
        date_start: parseMmDdYyyy(row.issuance_date),
        location_desc: `${row.house__ ?? ""} ${row.street_name ?? ""}`.trim() || undefined,
        source_dataset_id: "ipu4-2q9a" as const,
        raw_id: row.permit_si_no,
        lat: Number(row.gis_latitude),
        lon: Number(row.gis_longitude),
      })),
    ].slice(0, 12);

    if (!context.location.bin) {
      moduleWarnings.push("BIN metadata missing; DOB complaints are likely undercounted for this query.");
    }
    if (!context.location.bbl) {
      moduleWarnings.push("BBL metadata missing; ECB violation matching uses available BIN only.");
    }

    if (moduleWarnings.length > 0) {
      moduleCard.status = "partial";
      moduleCard.warnings = moduleWarnings;
      moduleCard.coverage_note = "Non-geocoded DOB datasets rely on BIN/BBL matching in v1.";
    }

    if (latestViolation) {
      moduleCard.stats.push({ label: "Latest ECB issue date", value: latestViolation });
    }
    if (complaintsTotal > 0) {
      moduleCard.stats.push({ label: "Open complaints", value: openComplaints });
    }

    return moduleCard;
  } catch (error) {
    return unavailableModule(
      "dob_permits",
      "DOB permit and complaint data is temporarily unavailable.",
      sources,
      methodology,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export const dobPermitsModule: ModuleBuilder = {
  id: "dob_permits",
  build: buildDobPermitsModule,
};
