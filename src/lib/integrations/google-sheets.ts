import { google } from "googleapis";
import { logger } from "@/lib/observability/logger";

export interface DigestSheetRow {
  generated_at_utc: string;
  block_id: string;
  normalized_address: string;
  active_disruptions: number;
  requests_30d: number;
  crashes_90d: number;
  injuries_90d: number;
  upcoming_events_30d: number;
}

function envOrEmpty(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function privateKey(): string {
  return envOrEmpty("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function configured(): boolean {
  return Boolean(
    envOrEmpty("GOOGLE_SHEETS_SPREADSHEET_ID") &&
      envOrEmpty("GOOGLE_SERVICE_ACCOUNT_EMAIL") &&
      privateKey(),
  );
}

export async function appendDigestRowsToSheet(rows: DigestSheetRow[]): Promise<{ written: number; skipped: boolean }> {
  if (!rows.length) {
    return { written: 0, skipped: false };
  }

  if (!configured()) {
    return { written: 0, skipped: true };
  }

  const auth = new google.auth.JWT({
    email: envOrEmpty("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: privateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = envOrEmpty("GOOGLE_SHEETS_SPREADSHEET_ID");
  const worksheet = envOrEmpty("GOOGLE_SHEETS_WORKSHEET_NAME") || "WeeklyDigest";

  const values = rows.map((row) => [
    row.generated_at_utc,
    row.block_id,
    row.normalized_address,
    row.active_disruptions,
    row.requests_30d,
    row.crashes_90d,
    row.injuries_90d,
    row.upcoming_events_30d,
  ]);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${worksheet}!A:H`,
        valueInputOption: "RAW",
        requestBody: {
          values,
        },
      });

      return { written: rows.length, skipped: false };
    } catch (error) {
      logger.warn({ attempt, error }, "failed appending digest rows to google sheets");
      if (attempt === 1) {
        throw error;
      }
    }
  }

  return { written: 0, skipped: false };
}
