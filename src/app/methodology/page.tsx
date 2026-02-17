import Link from "next/link";
import { DATASET_IDS, DATASETS } from "@/config/datasets";

export const metadata = {
  title: "Methodology | What's Happening on My Block?",
};

export default function MethodologyPage() {
  return (
    <main className="content-page">
      <header>
        <p className="eyebrow">Methodology</p>
        <h1>How the block brief is calculated</h1>
      </header>

      <section>
        <h2>Core query geometry</h2>
        <p>
          v1 uses point + radius queries (150m and 400m) for consistent, fast results. Where a dataset lacks reliable point geometry, the
          app uses transparent fallback matching (BIN/BBL, borough, community district, or ZIP).
        </p>
      </section>

      <section>
        <h2>Scoring and ranking</h2>
        <ul>
          <li>311 Pulse: top complaint types by count in the last 30 days, with delta versus prior 30 days.</li>
          <li>Street works: active now first, then longer duration, then proximity.</li>
          <li>Collisions: hotspot derived by clustering collisions within 75m.</li>
          <li>Right now strip: active closures + active street works + active film permits.</li>
          <li>
            Events: borough feed is locally filtered using community district match, closure signal, and nearby street-text relevance.
          </li>
        </ul>
      </section>

      <section>
        <h2>Severity scale and impact framing</h2>
        <p>Each module shows Low / Medium / High severity plus a “What this means for you” sentence.</p>
        <ul>
          <li>Right now: Low 0 active disruptions, Medium 1-2, High 3+.</li>
          <li>Street works: Low 0-1 active disruptions, Medium 2-4, High 5+.</li>
          <li>Collisions: High if injuries 8+ or crashes 40+; Medium if injuries 3+ or crashes 15+.</li>
          <li>311 pulse: High if requests 350+ or 30-day increase 120+; Medium if requests 150+ or increase 50+.</li>
          <li>Events: Low 0-7 locally relevant events, Medium 8-19, High 20+.</li>
        </ul>
      </section>

      <section>
        <h2>Reliability model</h2>
        <ul>
          <li>Each module is fetched independently and rendered even if other modules fail.</li>
          <li>Server-side caching is keyed by block identity and dataset window.</li>
          <li>Data source links and per-module calculation notes are always visible in the brief.</li>
        </ul>
      </section>

      <section>
        <h2>Known limitations</h2>
        <ul>
          <li>Some datasets expose weak or missing geocoded fields, requiring fallback matching.</li>
          <li>
            Sanitation in v1 uses DSNY Frequencies ({" "}
            <a href={DATASETS["rv63-53db"].url} target="_blank" rel="noreferrer">
              rv63-53db
            </a>
            ) because the listed primary source ({" "}
            <a href={DATASETS["p7k6-2pm8"].url} target="_blank" rel="noreferrer">
              p7k6-2pm8
            </a>
            ) is currently sparse via API.
          </li>
          <li>Blockface precision is deferred to a future version; v1 prioritizes fast consistency.</li>
        </ul>
      </section>

      <section>
        <h2>Dataset links</h2>
        <ul>
          {DATASET_IDS.map((id) => (
            <li key={id}>
              <a href={DATASETS[id].url} target="_blank" rel="noreferrer">
                {DATASETS[id].name} ({id})
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Source code</h2>
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
