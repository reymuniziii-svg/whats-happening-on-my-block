"use client";

import type { BriefResponse, Module } from "@/types/brief";

interface BriefInsightsProps {
  brief: BriefResponse;
}

function findModule(brief: BriefResponse, id: Module["id"]): Module | undefined {
  return brief.modules.find((module) => module.id === id);
}

function numericStat(module: Module | undefined, label: string): number {
  const stat = module?.stats.find((item) => item.label === label);
  if (!stat) {
    return 0;
  }
  if (typeof stat.value === "number") {
    return stat.value;
  }
  const parsed = Number(stat.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statDelta(module: Module | undefined, label: string): number | null {
  const stat = module?.stats.find((item) => item.label === label);
  return typeof stat?.delta === "number" ? stat.delta : null;
}

export function BriefInsights({ brief }: BriefInsightsProps) {
  const rightNow = findModule(brief, "right_now");
  const disruptions =
    numericStat(rightNow, "Active closures") +
    numericStat(rightNow, "Active street works") +
    numericStat(rightNow, "Active film permits");

  const collisions = findModule(brief, "collisions");
  const crashes = numericStat(collisions, "Crashes (90d)");
  const injuries = numericStat(collisions, "Injuries (90d)");

  const pulse311 = findModule(brief, "311_pulse");
  const requests30d = numericStat(pulse311, "Requests (30d)");
  const requestsDelta = statDelta(pulse311, "Requests (30d)");
  const trendLabel =
    requestsDelta === null || requestsDelta === 0 ? "steady" : requestsDelta > 0 ? `up ${requestsDelta}` : `down ${Math.abs(requestsDelta)}`;

  const events = findModule(brief, "events");
  const film = findModule(brief, "film");
  const upcomingEvents = numericStat(events, "Upcoming events");
  const upcomingFilm = numericStat(film, "Upcoming permits");

  return (
    <section className="insights-strip" aria-label="At a glance summary">
      <article className="insight-card">
        <p className="insight-label">Right now</p>
        <p className="insight-value">{disruptions === 0 ? "Calm block conditions" : `${disruptions} active disruptions`}</p>
      </article>
      <article className="insight-card">
        <p className="insight-label">Safety (90 days)</p>
        <p className="insight-value">
          {crashes} crashes, {injuries} injuries
        </p>
      </article>
      <article className="insight-card">
        <p className="insight-label">311 trend</p>
        <p className="insight-value">
          {requests30d} requests, {trendLabel}
        </p>
      </article>
      <article className="insight-card">
        <p className="insight-label">Next 30 days</p>
        <p className="insight-value">
          {upcomingEvents} events, {upcomingFilm} film permits
        </p>
      </article>
    </section>
  );
}
