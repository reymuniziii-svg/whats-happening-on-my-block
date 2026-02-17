import Link from "next/link";
import { DATASETS } from "@/config/datasets";
import { MethodologyExplorer } from "@/components/MethodologyExplorer";

export const metadata = {
  title: "Methodology | What's Happening on My Block?",
};

export default function MethodologyPage() {
  return (
    <main className="content-page methodology-page">
      <header className="methodology-header">
        <p className="eyebrow">Methodology</p>
        <h1>How the block brief is calculated</h1>
        <p className="method-lead">
          The brief is designed to be useful in about 10 seconds and transparent in under a minute. This page shows the exact logic behind
          each module, where fallback matching is used, and how severity labels are assigned.
        </p>
      </header>

      <section className="method-summary-grid" aria-label="Methodology summary">
        <article className="method-summary-card">
          <h2>Geometry First</h2>
          <p>v1 prioritizes point + radius for predictable, fast API queries.</p>
          <p className="method-mini">Default radii: 150m (block-ish) and 400m (nearby).</p>
        </article>

        <article className="method-summary-card">
          <h2>Transparent Severity</h2>
          <p>Every module includes Low/Medium/High plus threshold copy and impact framing.</p>
          <p className="method-mini">No hidden scoring model.</p>
        </article>

        <article className="method-summary-card">
          <h2>Resilient By Design</h2>
          <p>Dataset failures degrade a module, not the whole page.</p>
          <p className="method-mini">Partial rendering + per-dataset caching.</p>
        </article>
      </section>

      <MethodologyExplorer />

      <section className="method-details">
        <details open>
          <summary>Scoring and ranking rules</summary>
          <ul>
            <li>311 pulse ranks complaint types by count in the current 30-day window, then compares to prior 30 days.</li>
            <li>Street works ranks active-now first, then longer duration, then proximity.</li>
            <li>Collisions clusters records within 75m and labels hotspot by frequent intersection text.</li>
            <li>Right now strip combines active closures, active street works, and active film permits.</li>
            <li>Events are ranked for locality using community district, closure signal, and nearby street-text signal.</li>
          </ul>
        </details>

        <details>
          <summary>Reliability and caching model</summary>
          <ul>
            <li>Each module queries independently so one outage does not blank the full brief.</li>
            <li>Per-block and per-dataset cache keys reduce latency and API load.</li>
            <li>High-churn datasets refresh frequently while stable layers cache longer.</li>
            <li>User-visible warnings appear when partial data is shown.</li>
          </ul>
        </details>

        <details>
          <summary>Known limitations and current fallbacks</summary>
          <ul>
            <li>Some datasets lack stable geometry and require BIN/BBL, borough, ZIP, or text-based matching.</li>
            <li>
              Sanitation uses DSNY Frequencies (
              <a href={DATASETS["rv63-53db"].url} target="_blank" rel="noreferrer">
                rv63-53db
              </a>
              ) while the preferred schedule source (
              <a href={DATASETS["p7k6-2pm8"].url} target="_blank" rel="noreferrer">
                p7k6-2pm8
              </a>
              ) remains sparse through this API path.
            </li>
            <li>v1 uses radius consistency over full blockface precision for speed and reliability.</li>
          </ul>
        </details>
      </section>

      <section className="method-links">
        <h2>Source code</h2>
        <p>
          Live app:{" "}
          <a href="https://whats-happening-on-my-block.vercel.app" target="_blank" rel="noreferrer">
            whats-happening-on-my-block.vercel.app
          </a>
        </p>
        <p>
          <a href="https://github.com/reymuniziii-svg/whats-happening-on-my-block" target="_blank" rel="noreferrer">
            github.com/reymuniziii-svg/whats-happening-on-my-block
          </a>
        </p>
      </section>

      <p>
        <Link href="/">Back to search</Link>
      </p>
    </main>
  );
}
