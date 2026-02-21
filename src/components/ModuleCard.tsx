"use client";

import { useState } from "react";
import type { Module } from "@/types/brief";
import { interpretModule } from "@/lib/insights/module-interpretation";

interface ModuleCardProps {
  module: Module;
  blockId?: string;
  selectedFeaturePrefix?: string | null;
  onItemFocusFeature?: (prefix: string | null) => void;
  detailContextLabel?: "now" | "24h" | "7d" | "30d";
}

interface All311Call {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  date_start?: string;
  date_end?: string;
  location_desc?: string;
}

interface All311CallsResponse {
  total_calls: number;
  returned_calls: number;
  truncated: boolean;
  window_days: number;
  radius_m: number;
  generated_at_utc: string;
  methodology: string;
  source: {
    dataset_id: string;
    dataset_name: string;
    dataset_url: string;
  };
  calls: All311Call[];
  error?: string;
}

const MODULE_LABELS: Record<Module["id"], string> = {
  right_now: "Right now",
  dob_permits: "Construction (DOB)",
  street_works: "Street disruption (DOT)",
  collisions: "Safety (collisions)",
  "311_pulse": "311 pulse",
  sanitation: "Sanitation",
  events: "Upcoming events",
  film: "Film permits",
};

export function moduleLabelFor(id: Module["id"]): string {
  return MODULE_LABELS[id];
}

const MODULE_DESCRIPTIONS: Record<Module["id"], string> = {
  right_now: "Active closures, street works, and film activity happening now.",
  dob_permits: "Permits, complaints, and violations that may impact daily life.",
  street_works: "Current and near-term street work conditions and permit activity.",
  collisions: "Recent crash and injury trends around this location.",
  "311_pulse": "Most common neighborhood complaints from recent 311 requests.",
  sanitation: "Area-level refuse, recycling, organics, and bulk service frequency.",
  events: "Permitted events expected over the next 30 days.",
  film: "Film permit activity that can affect parking and traffic.",
};

function formatDate(value?: string): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateRange(start?: string, end?: string): string | null {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }
  return startLabel ?? endLabel ?? null;
}

function formatStatValue(value: string | number): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }
  return value;
}

function formatDelta(delta: number): string {
  if (delta === 0) {
    return "No change vs prior period";
  }
  if (delta > 0) {
    return `Up ${delta} vs prior period`;
  }
  return `Down ${Math.abs(delta)} vs prior period`;
}

function statusLabel(status: Module["status"]): string {
  if (status === "ok") {
    return "Available";
  }
  if (status === "partial") {
    return "Partial";
  }
  return "Unavailable";
}

function summarizeWarnings(warnings: string[]): { summary: string; technical: string[] } {
  const joined = warnings.join(" ").toLowerCase();
  const technicalSignal =
    joined.includes("soda") ||
    joined.includes("timed out") ||
    joined.includes("abort") ||
    joined.includes("query");

  if (technicalSignal) {
    return {
      summary: "Some live feeds were slow or unavailable. Showing the best available data for now.",
      technical: warnings,
    };
  }

  return {
    summary: warnings.join(" "),
    technical: [],
  };
}

function itemFeaturePrefix(module: Module, item: Module["items"][number]): string {
  return `${module.id}:${item.raw_id ?? item.title}`;
}

function lensLabel(lens?: "now" | "24h" | "7d" | "30d"): string | null {
  if (!lens) {
    return null;
  }
  if (lens === "now") {
    return "now";
  }
  if (lens === "24h") {
    return "24h";
  }
  if (lens === "7d") {
    return "7d";
  }
  return "30d";
}

export function ModuleCard({ module, blockId, onItemFocusFeature, selectedFeaturePrefix, detailContextLabel }: ModuleCardProps) {
  const label = moduleLabelFor(module.id);
  const description = MODULE_DESCRIPTIONS[module.id];
  const warningCopy = module.warnings?.length ? summarizeWarnings(module.warnings) : null;
  const interpretation = interpretModule(module);
  const detailsLens = lensLabel(detailContextLabel);
  const [all311State, setAll311State] = useState<{
    loading: boolean;
    error: string | null;
    data: All311CallsResponse | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });

  async function fetchAll311Calls(forceRefresh = false): Promise<void> {
    if (module.id !== "311_pulse" || !blockId || all311State.loading) {
      return;
    }
    if (!forceRefresh && all311State.data) {
      return;
    }

    setAll311State((current) => ({
      loading: true,
      error: null,
      data: current.data,
    }));

    try {
      const response = await fetch(`/api/brief/by-block/${encodeURIComponent(blockId)}/311-calls?days=30`);
      const json = (await response.json()) as All311CallsResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Could not load all nearby 311 calls.");
      }

      setAll311State({
        loading: false,
        error: null,
        data: json,
      });
    } catch (error) {
      setAll311State((current) => ({
        loading: false,
        error: error instanceof Error ? error.message : "Could not load all nearby 311 calls.",
        data: current.data,
      }));
    }
  }

  return (
    <section className="module-card" id={module.id} aria-labelledby={`${module.id}-title`}>
      <header className="module-header">
        <div>
          <h2 id={`${module.id}-title`}>{label}</h2>
          <p className="module-subtitle">{description}</p>
        </div>
        <div className="module-chip-stack">
          <span className={`status-chip ${module.status}`}>{statusLabel(module.status)}</span>
          <span className={`severity-chip ${interpretation.severity}`}>Severity {interpretation.severityLabel}</span>
        </div>
      </header>

      <p className="module-headline">{module.headline}</p>
      <p className="module-impact">
        <strong>What this means for you:</strong> {interpretation.impact}
      </p>
      <p className="module-thresholds">
        <strong>Severity thresholds:</strong> {interpretation.thresholdNote}
      </p>

      <div className="module-stats" role="list">
        {module.stats.map((stat) => (
          <div key={`${module.id}-${stat.label}`} role="listitem" className="stat-box">
            <span className="stat-label">{stat.label}</span>
            <span className="stat-value">
              {formatStatValue(stat.value)}
              {stat.unit ? ` ${stat.unit}` : ""}
            </span>
            {typeof stat.delta === "number" ? (
              <span className={stat.delta >= 0 ? "stat-delta up" : "stat-delta down"}>
                {formatDelta(stat.delta)}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {warningCopy ? (
        <div className="module-warning" role="status">
          <p>{warningCopy.summary}</p>
          {warningCopy.technical.length > 0 ? (
            <details className="warning-technical">
              <summary>Technical details</summary>
              <p>{warningCopy.technical.join(" | ")}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      {module.coverage_note ? <p className="coverage-note">{module.coverage_note}</p> : null}

      <details>
        <summary>
          Details ({module.items.length}
          {detailsLens ? ` in ${detailsLens}` : ""})
        </summary>
        {module.items.length ? (
          <ul className="detail-list">
            {module.items.map((item, index) => {
              const whenLabel = formatDateRange(item.date_start, item.date_end);
              return (
                <li
                  key={`${module.id}-${item.raw_id ?? `${item.title}-${index}`}`}
                  className={selectedFeaturePrefix === itemFeaturePrefix(module, item) ? "detail-row-highlighted" : undefined}
                  onMouseEnter={() => onItemFocusFeature?.(itemFeaturePrefix(module, item))}
                  onMouseLeave={() => onItemFocusFeature?.(null)}
                  onFocus={() => onItemFocusFeature?.(itemFeaturePrefix(module, item))}
                  onBlur={() => onItemFocusFeature?.(null)}
                  tabIndex={0}
                >
                  <h3>{item.title}</h3>
                  {item.subtitle ? <p>{item.subtitle}</p> : null}
                  {whenLabel ? (
                    <p className="detail-meta">
                      <strong>When:</strong> {whenLabel}
                    </p>
                  ) : null}
                  {item.location_desc ? (
                    <p className="detail-meta">
                      <strong>Where:</strong> {item.location_desc}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-details">No detail rows in this time window.</p>
        )}

        {module.id === "311_pulse" ? (
          <section className="module-311-all">
            <button type="button" className="module-311-all-button" onClick={() => fetchAll311Calls(Boolean(all311State.data))}>
              {all311State.data ? "Refresh all 311 calls" : "See all 311 calls"}
            </button>
            <p className="module-311-all-note">Loads individual nearby requests on demand to keep the main brief fast.</p>

            {all311State.loading ? <p className="module-311-loading">Loading nearby 311 calls...</p> : null}
            {all311State.error ? <p className="module-311-error">{all311State.error}</p> : null}

            {all311State.data ? (
              <>
                <p className="module-311-summary">
                  Showing {all311State.data.returned_calls} of {all311State.data.total_calls} requests from the last{" "}
                  {all311State.data.window_days} days within {all311State.data.radius_m}m.
                  {all311State.data.truncated ? " Results are capped to keep load times stable." : ""}
                </p>

                {all311State.data.calls.length > 0 ? (
                  <ul className="detail-list detail-list-compact">
                    {all311State.data.calls.map((call, index) => {
                      const whenLabel = formatDateRange(call.date_start, call.date_end);
                      return (
                        <li key={`all-311-${call.id}-${index}`}>
                          <h3>{call.title}</h3>
                          {call.subtitle ? <p>{call.subtitle}</p> : null}
                          {whenLabel ? (
                            <p className="detail-meta">
                              <strong>When:</strong> {whenLabel}
                            </p>
                          ) : null}
                          {call.location_desc ? (
                            <p className="detail-meta">
                              <strong>Where:</strong> {call.location_desc}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="empty-details">No individual 311 calls found in this window.</p>
                )}

                <p className="module-311-source">
                  <strong>How this list is calculated:</strong> {all311State.data.methodology}
                </p>
                <p className="module-311-source">
                  <strong>Data source:</strong>{" "}
                  <a href={all311State.data.source.dataset_url} target="_blank" rel="noreferrer">
                    {all311State.data.source.dataset_name}
                  </a>
                </p>
              </>
            ) : null}
          </section>
        ) : null}
      </details>

      <footer className="module-footer">
        <p>
          <strong>How this is calculated:</strong> {module.methodology}
        </p>
        <p>
          <strong>Data source:</strong>{" "}
          {module.sources.map((source, index) => (
            <span key={source.dataset_id}>
              <a href={source.dataset_url} target="_blank" rel="noreferrer">
                {source.dataset_name}
              </a>
              {index < module.sources.length - 1 ? "; " : ""}
            </span>
          ))}
        </p>
      </footer>
    </section>
  );
}
