import type { Module } from "@/types/brief";
import { interpretModule } from "@/lib/insights/module-interpretation";

interface ModuleCardProps {
  module: Module;
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

export function ModuleCard({ module }: ModuleCardProps) {
  const label = moduleLabelFor(module.id);
  const description = MODULE_DESCRIPTIONS[module.id];
  const warningCopy = module.warnings?.length ? summarizeWarnings(module.warnings) : null;
  const interpretation = interpretModule(module);

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
        <summary>Details ({module.items.length})</summary>
        {module.items.length ? (
          <ul className="detail-list">
            {module.items.map((item, index) => (
              <li key={`${module.id}-${item.raw_id ?? `${item.title}-${index}`}`}>
                <h3>{item.title}</h3>
                {item.subtitle ? <p>{item.subtitle}</p> : null}
                {formatDateRange(item.date_start, item.date_end) ? (
                  <p className="detail-meta">
                    <strong>When:</strong> {formatDateRange(item.date_start, item.date_end)}
                  </p>
                ) : null}
                {item.location_desc ? (
                  <p className="detail-meta">
                    <strong>Where:</strong> {item.location_desc}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-details">No detail rows in this time window.</p>
        )}
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
