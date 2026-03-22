import { buildBrief } from "@/lib/brief/build-brief";
import { decodeBlockId } from "@/lib/brief/share-id";
import { summaryMetrics } from "@/lib/brief/summary-metrics";
import { Prisma } from "@prisma/client";
import { prisma, prismaEnabled } from "@/lib/db/client";
import { appendDigestRowsToSheet, type DigestSheetRow } from "@/lib/integrations/google-sheets";
import { logger } from "@/lib/observability/logger";
import { listAllTrackedBlocks } from "@/lib/watchlist/service";
import type { ResolvedLocation } from "@/types/brief";

interface DigestRunResult {
  run_id: string;
  processed_blocks: number;
  written_sheet_rows: number;
  skipped_sheet_write: boolean;
  failures: Array<{ block_id: string; error: string }>;
}

function rowKey(dateIso: string, blockId: string): string {
  return `${dateIso.slice(0, 10)}:${blockId}`;
}

async function createDigestRun(watchlistId?: string): Promise<string> {
  if (!prismaEnabled()) {
    return `memory-${Date.now()}`;
  }

  const run = await prisma.digestRun.create({
    data: {
      watchlistId,
      status: "running",
    },
  });

  return run.id;
}

async function completeDigestRun(runId: string, status: "success" | "partial" | "failed", error?: string): Promise<void> {
  if (!prismaEnabled()) {
    return;
  }

  await prisma.digestRun.update({
    where: { id: runId },
    data: {
      status,
      completedAt: new Date(),
      error,
    },
  });
}

async function storeDigestRows(runId: string, rows: DigestSheetRow[]): Promise<void> {
  if (!prismaEnabled() || !rows.length) {
    return;
  }

  for (const row of rows) {
    await prisma.digestRow.upsert({
      where: {
        rowKey: rowKey(row.generated_at_utc, row.block_id),
      },
      update: {
        payload: row as unknown as Prisma.InputJsonValue,
        normalizedAddress: row.normalized_address,
      },
      create: {
        digestRunId: runId,
        blockId: row.block_id,
        normalizedAddress: row.normalized_address,
        rowKey: rowKey(row.generated_at_utc, row.block_id),
        payload: row as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

function locationFromBlockId(blockId: string): ResolvedLocation {
  const payload = decodeBlockId(blockId);
  return {
    normalized_address: payload.normalized_address ?? `${payload.lat}, ${payload.lon}`,
    geocoder: "geosearch",
    lat: payload.lat,
    lon: payload.lon,
    bbl: payload.bbl,
    bin: payload.bin,
    borough: payload.borough,
    community_district: payload.community_district,
    council_district: payload.council_district,
    zip_code: payload.zip_code,
  };
}

export async function runWeeklyDigest(): Promise<DigestRunResult> {
  const runId = await createDigestRun();
  const trackedBlocks = await listAllTrackedBlocks();
  const nowIso = new Date().toISOString();

  const rows: DigestSheetRow[] = [];
  const failures: Array<{ block_id: string; error: string }> = [];

  for (const tracked of trackedBlocks) {
    try {
      const location = locationFromBlockId(tracked.block_id);
      const brief = await buildBrief({ location });
      const metrics = summaryMetrics(brief);

      rows.push({
        generated_at_utc: nowIso,
        block_id: tracked.block_id,
        normalized_address: brief.input.normalized_address,
        active_disruptions: metrics.activeDisruptions,
        requests_30d: metrics.requests30d,
        crashes_90d: metrics.crashes90d,
        injuries_90d: metrics.injuries90d,
        upcoming_events_30d: metrics.upcomingEvents,
      });
    } catch (error) {
      failures.push({
        block_id: tracked.block_id,
        error: error instanceof Error ? error.message : "unknown digest error",
      });
    }
  }

  await storeDigestRows(runId, rows);

  let writtenSheetRows = 0;
  let skippedSheetWrite = false;
  try {
    const sheetResult = await appendDigestRowsToSheet(rows);
    writtenSheetRows = sheetResult.written;
    skippedSheetWrite = sheetResult.skipped;
  } catch (error) {
    logger.error({ run_id: runId, error }, "failed writing digest rows to google sheets");
  }

  const status = failures.length === 0 ? "success" : rows.length > 0 ? "partial" : "failed";
  await completeDigestRun(runId, status, failures.length > 0 ? `${failures.length} block(s) failed` : undefined);

  return {
    run_id: runId,
    processed_blocks: rows.length,
    written_sheet_rows: writtenSheetRows,
    skipped_sheet_write: skippedSheetWrite,
    failures,
  };
}
