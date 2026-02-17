import type { Module } from "@/types/brief";

interface ModuleCardProps {
  module: Module;
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <section className="module-card" aria-labelledby={`${module.id}-title`}>
      <header className="module-header">
        <h2 id={`${module.id}-title`}>{module.id.replace(/_/g, " ")}</h2>
        <span className={`status-chip ${module.status}`}>{module.status}</span>
      </header>

      <p className="module-headline">{module.headline}</p>

      <div className="module-stats" role="list">
        {module.stats.map((stat) => (
          <div key={`${module.id}-${stat.label}`} role="listitem" className="stat-box">
            <span className="stat-label">{stat.label}</span>
            <span className="stat-value">
              {stat.value}
              {stat.unit ? ` ${stat.unit}` : ""}
            </span>
            {typeof stat.delta === "number" ? (
              <span className={stat.delta >= 0 ? "stat-delta up" : "stat-delta down"}>
                {stat.delta >= 0 ? "+" : ""}
                {stat.delta}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {module.warnings?.length ? (
        <div className="module-warning" role="status">
          {module.warnings.join(" ")}
        </div>
      ) : null}

      {module.coverage_note ? <p className="coverage-note">{module.coverage_note}</p> : null}

      <details>
        <summary>Details</summary>
        <ul className="detail-list">
          {module.items.map((item, index) => (
            <li key={`${module.id}-${item.raw_id ?? `${item.title}-${index}`}`}>
              <h3>{item.title}</h3>
              {item.subtitle ? <p>{item.subtitle}</p> : null}
              <p className="detail-meta">
                {[item.date_start ? new Date(item.date_start).toLocaleString("en-US") : null, item.location_desc]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            </li>
          ))}
        </ul>
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
