"use client";

import { useMemo, useState } from "react";
import { BriefInsights } from "@/components/BriefInsights";
import { MapPanel } from "@/components/MapPanel";
import { ModuleCard, moduleLabelFor } from "@/components/ModuleCard";
import type { BriefMapFeature, BriefResponse, Module, ModuleId, ModuleItem } from "@/types/brief";

type TimeLens = "now" | "24h" | "7d" | "30d";

const LENS_OPTIONS: Array<{ id: TimeLens; label: string }> = [
  { id: "now", label: "Now" },
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

function itemPrefix(moduleId: ModuleId, item: ModuleItem): string {
  return `${moduleId}:${item.raw_id ?? item.title}`;
}

function featurePrefix(featureId: string): string {
  return featureId.replace(/:(point|line)$/, "");
}

function parseTimestamp(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isActiveNow(startTs: number | undefined, endTs: number | undefined, nowTs: number): boolean {
  if (startTs !== undefined && endTs !== undefined) {
    return nowTs >= startTs && nowTs <= endTs;
  }
  return false;
}

function shouldKeepItem(item: ModuleItem, lens: TimeLens, nowTs: number): boolean {
  const startTs = parseTimestamp(item.date_start);
  const endTs = parseTimestamp(item.date_end);

  if (startTs === undefined && endTs === undefined) {
    return true;
  }

  const active = isActiveNow(startTs, endTs, nowTs);
  if (lens === "now") {
    if (active) {
      return true;
    }
    if (startTs !== undefined) {
      return Math.abs(startTs - nowTs) <= 3 * 60 * 60 * 1000;
    }
    if (endTs !== undefined) {
      return Math.abs(endTs - nowTs) <= 3 * 60 * 60 * 1000;
    }
    return false;
  }

  if (lens === "30d") {
    return true;
  }

  const windowMs = lens === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const isNear = (value: number | undefined) => value !== undefined && Math.abs(value - nowTs) <= windowMs;

  return active || isNear(startTs) || isNear(endTs);
}

function initialVisibility(modules: Module[]): Record<ModuleId, boolean> {
  const visible = {
    right_now: false,
    dob_permits: false,
    street_works: false,
    collisions: false,
    "311_pulse": false,
    sanitation: false,
    events: false,
    film: false,
  };

  for (const moduleData of modules) {
    visible[moduleData.id] = true;
  }

  return visible;
}

function setAllVisibility(value: boolean): Record<ModuleId, boolean> {
  return {
    right_now: value,
    dob_permits: value,
    street_works: value,
    collisions: value,
    "311_pulse": value,
    sanitation: value,
    events: value,
    film: value,
  };
}

interface BriefInteractivePanelsProps {
  brief: BriefResponse;
}

export function BriefInteractivePanels({ brief }: BriefInteractivePanelsProps) {
  const [timeLens, setTimeLens] = useState<TimeLens>("30d");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [visibleModules, setVisibleModules] = useState<Record<ModuleId, boolean>>(() => initialVisibility(brief.modules));
  const [selectedFeaturePrefix, setSelectedFeaturePrefix] = useState<string | null>(null);
  const [referenceNow] = useState<number>(() => Date.now());

  const displayedModules = useMemo(() => {
    return brief.modules
      .filter((moduleData) => visibleModules[moduleData.id])
      .map((moduleData) => ({
        ...moduleData,
        items: moduleData.items.filter((item) => shouldKeepItem(item, timeLens, referenceNow)),
      }));
  }, [brief.modules, referenceNow, timeLens, visibleModules]);

  const filteredMapFeatures = useMemo(() => {
    const visibleIds = new Set(displayedModules.map((moduleData) => moduleData.id));
    if (timeLens === "30d") {
      return brief.map.features.filter((feature) => visibleIds.has(feature.module_id));
    }

    const allowedPrefixes = new Set<string>();
    for (const moduleData of displayedModules) {
      for (const item of moduleData.items) {
        allowedPrefixes.add(itemPrefix(moduleData.id, item));
      }
    }

    return brief.map.features.filter(
      (feature) => visibleIds.has(feature.module_id) && allowedPrefixes.has(featurePrefix(feature.id)),
    );
  }, [brief.map.features, displayedModules, timeLens]);
  const resolvedSelectedPrefix =
    selectedFeaturePrefix && filteredMapFeatures.some((feature) => featurePrefix(feature.id) === selectedFeaturePrefix)
      ? selectedFeaturePrefix
      : null;

  const filteredMap = useMemo(
    () => ({
      ...brief.map,
      features: filteredMapFeatures as BriefMapFeature[],
    }),
    [brief.map, filteredMapFeatures],
  );

  const visibleModuleCount = displayedModules.length;
  const hiddenModuleCount = brief.modules.length - visibleModuleCount;

  return (
    <>
      <BriefInsights brief={brief} />

      <section className="brief-toolbar" aria-label="View controls">
        <div className="time-lens">
          <span className="toolbar-label">Time lens</span>
          <div className="time-lens-pills" role="tablist" aria-label="Time lens">
            {LENS_OPTIONS.map((lens) => (
              <button
                key={lens.id}
                type="button"
                className={timeLens === lens.id ? "lens-pill active" : "lens-pill"}
                onClick={() => setTimeLens(lens.id)}
                aria-pressed={timeLens === lens.id}
              >
                {lens.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="drawer-toggle" onClick={() => setIsFilterDrawerOpen(true)}>
          Quick filters
        </button>
      </section>

      <p className="toolbar-note">
        Detail rows and map features are filtered by the selected lens. Module summary stats remain on each module&apos;s source time
        window.
      </p>

      <nav className="module-nav" aria-label="Jump to module">
        {displayedModules.map((moduleData) => (
          <a key={moduleData.id} href={`#${moduleData.id}`}>
            {moduleLabelFor(moduleData.id)}
          </a>
        ))}
      </nav>

      <MapPanel
        map={filteredMap}
        selectedFeaturePrefix={resolvedSelectedPrefix}
        onFeatureSelect={(prefix) => setSelectedFeaturePrefix(prefix)}
      />

      <section className="module-stack" aria-label="Modules">
        {displayedModules.map((moduleData) => (
          <ModuleCard
            key={moduleData.id}
            module={moduleData}
            selectedFeaturePrefix={resolvedSelectedPrefix}
            detailContextLabel={timeLens}
            onItemFocusFeature={(prefix) => setSelectedFeaturePrefix(prefix)}
          />
        ))}
      </section>

      <div
        className={isFilterDrawerOpen ? "drawer-overlay open" : "drawer-overlay"}
        onClick={() => setIsFilterDrawerOpen(false)}
        aria-hidden={!isFilterDrawerOpen}
      >
        <aside className={isFilterDrawerOpen ? "filters-drawer open" : "filters-drawer"} onClick={(event) => event.stopPropagation()}>
          <header className="drawer-header">
            <h3>Quick Filters</h3>
            <button type="button" className="drawer-close" onClick={() => setIsFilterDrawerOpen(false)} aria-label="Close filters">
              Close
            </button>
          </header>

          <p className="drawer-note">
            Showing {visibleModuleCount} module{visibleModuleCount === 1 ? "" : "s"}
            {hiddenModuleCount > 0 ? `, ${hiddenModuleCount} hidden` : ""}.
          </p>

          <div className="drawer-actions">
            <button type="button" onClick={() => setVisibleModules(setAllVisibility(true))}>
              Show all
            </button>
            <button type="button" onClick={() => setVisibleModules(setAllVisibility(false))}>
              Hide all
            </button>
          </div>

          <div className="drawer-list">
            {brief.modules.map((moduleData) => (
              <label key={`filter-${moduleData.id}`} className="drawer-item">
                <input
                  type="checkbox"
                  checked={visibleModules[moduleData.id]}
                  onChange={(event) =>
                    setVisibleModules((current) => ({
                      ...current,
                      [moduleData.id]: event.target.checked,
                    }))
                  }
                />
                <span>{moduleLabelFor(moduleData.id)}</span>
              </label>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
