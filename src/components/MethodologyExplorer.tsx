"use client";

import { useMemo, useState } from "react";
import { DATASET_IDS, DATASETS } from "@/config/datasets";
import { interpretModule } from "@/lib/insights/module-interpretation";
import type { Module, ModuleId, ModuleStat } from "@/types/brief";

type Scenario = {
  name: string;
  note: string;
  status?: Module["status"];
  stats: ModuleStat[];
};

const MODULE_LABELS: Record<ModuleId, string> = {
  right_now: "Right now",
  dob_permits: "Construction (DOB)",
  street_works: "Street disruption (DOT)",
  collisions: "Safety (collisions)",
  "311_pulse": "311 pulse",
  sanitation: "Sanitation",
  events: "Upcoming events",
  film: "Film permits",
};

const DEMO_SCENARIOS: Record<ModuleId, Scenario[]> = {
  right_now: [
    {
      name: "Calm block",
      note: "No active disruption signals.",
      stats: [
        { label: "Active closures", value: 0 },
        { label: "Active street works", value: 0 },
        { label: "Active film permits", value: 0 },
      ],
    },
    {
      name: "Moderate activity",
      note: "One closure and one street work active.",
      stats: [
        { label: "Active closures", value: 1 },
        { label: "Active street works", value: 1 },
        { label: "Active film permits", value: 0 },
      ],
    },
    {
      name: "Heavy disruption",
      note: "Multiple active signals at once.",
      stats: [
        { label: "Active closures", value: 2 },
        { label: "Active street works", value: 2 },
        { label: "Active film permits", value: 1 },
      ],
    },
  ],
  dob_permits: [
    {
      name: "Low activity",
      note: "Limited permit and complaint pressure.",
      stats: [
        { label: "DOB permits (90d)", value: 8 },
        { label: "DOB complaints (90d)", value: 2 },
        { label: "ECB violations (12m)", value: 1 },
      ],
    },
    {
      name: "Medium activity",
      note: "Construction and complaints are present.",
      stats: [
        { label: "DOB permits (90d)", value: 22 },
        { label: "DOB complaints (90d)", value: 11 },
        { label: "ECB violations (12m)", value: 3 },
      ],
    },
    {
      name: "High activity",
      note: "Strong permit volume and enforcement signal.",
      stats: [
        { label: "DOB permits (90d)", value: 44 },
        { label: "DOB complaints (90d)", value: 19 },
        { label: "ECB violations (12m)", value: 13 },
      ],
    },
  ],
  street_works: [
    {
      name: "Mostly clear",
      note: "Little active street work pressure.",
      stats: [
        { label: "Active street works", value: 1 },
        { label: "Active closures", value: 0 },
      ],
    },
    {
      name: "Frequent work windows",
      note: "Visible but not severe disruption.",
      stats: [
        { label: "Active street works", value: 2 },
        { label: "Active closures", value: 1 },
      ],
    },
    {
      name: "Major street pressure",
      note: "Multiple active impacts at once.",
      stats: [
        { label: "Active street works", value: 4 },
        { label: "Active closures", value: 2 },
      ],
    },
  ],
  collisions: [
    {
      name: "Lower collision signal",
      note: "Crash and injury totals are relatively low.",
      stats: [
        { label: "Crashes (90d)", value: 10 },
        { label: "Injuries (90d)", value: 1 },
      ],
    },
    {
      name: "Moderate caution",
      note: "Notable collision activity.",
      stats: [
        { label: "Crashes (90d)", value: 23 },
        { label: "Injuries (90d)", value: 4 },
      ],
    },
    {
      name: "Elevated safety concern",
      note: "High crash or injury counts.",
      stats: [
        { label: "Crashes (90d)", value: 42 },
        { label: "Injuries (90d)", value: 9 },
      ],
    },
  ],
  "311_pulse": [
    {
      name: "Steady volume",
      note: "Complaints are present but stable.",
      stats: [{ label: "Requests (30d)", value: 95, delta: 8 }],
    },
    {
      name: "Rising pressure",
      note: "Volume and trend indicate moderate stress.",
      stats: [{ label: "Requests (30d)", value: 205, delta: 65 }],
    },
    {
      name: "High complaint pressure",
      note: "High volume and sharp increase.",
      stats: [{ label: "Requests (30d)", value: 390, delta: 140 }],
    },
  ],
  sanitation: [
    {
      name: "Fully covered",
      note: "All area frequencies are available.",
      stats: [
        { label: "Refuse", value: "Mon, Wed, Fri" },
        { label: "Recycling", value: "Fri" },
        { label: "Organics", value: "Fri" },
        { label: "Bulk", value: "Mon, Wed, Fri" },
      ],
    },
    {
      name: "Partial schedule",
      note: "Some service fields are unresolved.",
      stats: [
        { label: "Refuse", value: "Mon, Wed, Fri" },
        { label: "Recycling", value: "N/A" },
        { label: "Organics", value: "Fri" },
        { label: "Bulk", value: "Mon, Wed, Fri" },
      ],
    },
    {
      name: "Unavailable",
      note: "No sanitation resolution for this request.",
      status: "unavailable",
      stats: [{ label: "Status", value: "Data temporarily unavailable" }],
    },
  ],
  events: [
    {
      name: "Quiet month",
      note: "Few locally relevant events.",
      stats: [{ label: "Upcoming events", value: 5 }],
    },
    {
      name: "Busy month",
      note: "Regular local event activity expected.",
      stats: [{ label: "Upcoming events", value: 14 }],
    },
    {
      name: "Very active month",
      note: "Sustained event load expected.",
      stats: [{ label: "Upcoming events", value: 27 }],
    },
  ],
  film: [
    {
      name: "No nearby shoots",
      note: "No active or upcoming permits nearby.",
      stats: [
        { label: "Upcoming permits", value: 0 },
        { label: "Active now", value: 0 },
      ],
    },
    {
      name: "Some filming",
      note: "Limited but visible permit activity.",
      stats: [
        { label: "Upcoming permits", value: 6 },
        { label: "Active now", value: 1 },
      ],
    },
    {
      name: "Heavy filming",
      note: "Frequent shoots and active restrictions.",
      stats: [
        { label: "Upcoming permits", value: 18 },
        { label: "Active now", value: 3 },
      ],
    },
  ],
};

function areaSqKm(radiusM: number): number {
  return Math.PI * radiusM * radiusM / 1_000_000;
}

export function MethodologyExplorer() {
  const [radius, setRadius] = useState(400);
  const [moduleId, setModuleId] = useState<ModuleId>("right_now");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [datasetQuery, setDatasetQuery] = useState("");
  const [datasetModule, setDatasetModule] = useState<ModuleId | "all">("all");

  const [communityMatch, setCommunityMatch] = useState(true);
  const [streetClosureSignal, setStreetClosureSignal] = useState(false);
  const [streetTextSignal, setStreetTextSignal] = useState(false);
  const [sportsEvent, setSportsEvent] = useState(true);

  const scenarios = DEMO_SCENARIOS[moduleId];

  const scenario = scenarios[scenarioIndex] ?? scenarios[0];

  const severityPreview = useMemo(() => {
    const moduleData: Module = {
      id: moduleId,
      headline: "Preview",
      status: scenario.status ?? "ok",
      stats: scenario.stats,
      items: [],
      methodology: "preview",
      sources: [],
    };

    return interpretModule(moduleData);
  }, [moduleId, scenario]);

  const radiusArea = areaSqKm(radius);
  const radiusAreaVs150 = radiusArea / areaSqKm(150);

  const eventScore = (communityMatch ? 5 : 0) + (streetClosureSignal ? 3 : 0) + (streetTextSignal ? 2 : 0) + (sportsEvent ? 0 : 1);
  const eventPriority =
    eventScore >= 8 ? "Very high relevance" : eventScore >= 5 ? "High relevance" : eventScore >= 3 ? "Medium relevance" : "Low relevance";

  const filteredDatasets = DATASET_IDS.filter((id) => {
    if (datasetModule !== "all" && !DATASETS[id].moduleHints.includes(datasetModule)) {
      return false;
    }
    const query = datasetQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return DATASETS[id].name.toLowerCase().includes(query) || id.includes(query);
  });

  return (
    <section className="method-explorer" aria-label="Interactive methodology explorer">
      <h2>Interactive Explorer</h2>
      <p className="method-lead">Use these controls to see how scoring, locality filtering, and data scope work behind the scenes.</p>

      <div className="method-grid">
        <article className="method-card">
          <h3>Geometry Scope</h3>
          <p>Adjust radius to see how much area each query can cover.</p>
          <label htmlFor="radius-range" className="method-label">
            Radius: {radius}m
          </label>
          <input
            id="radius-range"
            type="range"
            min={100}
            max={600}
            step={50}
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
          />
          <p className="method-note">
            Approx area: {radiusArea.toFixed(2)} km² ({radiusAreaVs150.toFixed(1)}x of 150m baseline)
          </p>
        </article>

        <article className="method-card">
          <h3>Severity Simulator</h3>
          <p>Preview the impact sentence and severity chip logic for each module.</p>
          <label htmlFor="module-select" className="method-label">
            Module
          </label>
          <select
            id="module-select"
            value={moduleId}
            onChange={(event) => {
              setModuleId(event.target.value as ModuleId);
              setScenarioIndex(0);
            }}
          >
            {(Object.keys(MODULE_LABELS) as ModuleId[]).map((id) => (
              <option key={id} value={id}>
                {MODULE_LABELS[id]}
              </option>
            ))}
          </select>

          <div className="scenario-pills" role="tablist" aria-label="Severity scenarios">
            {scenarios.map((entry, index) => (
              <button
                key={`${moduleId}-${entry.name}`}
                className={index === scenarioIndex ? "scenario-pill active" : "scenario-pill"}
                onClick={() => setScenarioIndex(index)}
                type="button"
              >
                {entry.name}
              </button>
            ))}
          </div>

          <p className="method-note">{scenario.note}</p>
          <p className={`severity-preview ${severityPreview.severity}`}>
            {severityPreview.severityLabel} severity. {severityPreview.impact}
          </p>
          <p className="method-threshold">{severityPreview.thresholdNote}</p>
        </article>

        <article className="method-card">
          <h3>Event Relevance Logic</h3>
          <p>Simulate how event rows are ranked to avoid borough-wide noise.</p>
          <label className="method-check">
            <input type="checkbox" checked={communityMatch} onChange={(event) => setCommunityMatch(event.target.checked)} />
            Community district match (+5)
          </label>
          <label className="method-check">
            <input type="checkbox" checked={streetClosureSignal} onChange={(event) => setStreetClosureSignal(event.target.checked)} />
            Street-closure signal (+3)
          </label>
          <label className="method-check">
            <input type="checkbox" checked={streetTextSignal} onChange={(event) => setStreetTextSignal(event.target.checked)} />
            Nearby street text match (+2)
          </label>
          <label className="method-check">
            <input type="checkbox" checked={sportsEvent} onChange={(event) => setSportsEvent(event.target.checked)} />
            Routine sports event (no +1 relevance boost)
          </label>
          <p className="method-note">
            Score: <strong>{eventScore}</strong> ({eventPriority})
          </p>
        </article>
      </div>

      <article className="method-card method-card-wide">
        <h3>Dataset Browser</h3>
        <p>Search datasets and filter by module to inspect source coverage quickly.</p>
        <div className="dataset-controls">
          <input
            type="text"
            placeholder="Search by name or dataset id"
            value={datasetQuery}
            onChange={(event) => setDatasetQuery(event.target.value)}
            aria-label="Search datasets"
          />
          <select value={datasetModule} onChange={(event) => setDatasetModule(event.target.value as ModuleId | "all")} aria-label="Filter datasets by module">
            <option value="all">All modules</option>
            {(Object.keys(MODULE_LABELS) as ModuleId[]).map((id) => (
              <option key={`dataset-${id}`} value={id}>
                {MODULE_LABELS[id]}
              </option>
            ))}
          </select>
        </div>
        <ul className="dataset-list">
          {filteredDatasets.map((id) => (
            <li key={id}>
              <a href={DATASETS[id].url} target="_blank" rel="noreferrer">
                {DATASETS[id].name}
              </a>
              <span>
                ({id}) • modules: {DATASETS[id].moduleHints.map((hint) => MODULE_LABELS[hint]).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
