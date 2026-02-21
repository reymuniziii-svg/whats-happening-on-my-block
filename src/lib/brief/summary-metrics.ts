import type { BriefResponse, Module } from "@/types/brief";

export interface SummaryMetrics {
  activeDisruptions: number;
  crashes90d: number;
  injuries90d: number;
  requests30d: number;
  upcomingEvents: number;
}

export function findModule(brief: BriefResponse, id: Module["id"]): Module | undefined {
  return brief.modules.find((moduleData) => moduleData.id === id);
}

export function numericStatFromModule(module: Module | undefined, label: string): number {
  const value = module?.stats.find((stat) => stat.label === label)?.value;
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function summaryMetrics(brief: BriefResponse): SummaryMetrics {
  const rightNow = findModule(brief, "right_now");
  const collisions = findModule(brief, "collisions");
  const pulse311 = findModule(brief, "311_pulse");
  const events = findModule(brief, "events");

  return {
    activeDisruptions:
      numericStatFromModule(rightNow, "Active closures") +
      numericStatFromModule(rightNow, "Active street works") +
      numericStatFromModule(rightNow, "Active film permits"),
    crashes90d: numericStatFromModule(collisions, "Crashes (90d)"),
    injuries90d: numericStatFromModule(collisions, "Injuries (90d)"),
    requests30d: numericStatFromModule(pulse311, "Requests (30d)"),
    upcomingEvents: numericStatFromModule(events, "Upcoming events"),
  };
}

export function topModuleItems(module: Module | undefined, limit = 3): Array<{ title: string; subtitle?: string }> {
  if (!module) {
    return [];
  }

  const unique: Array<{ title: string; subtitle?: string }> = [];
  const seen = new Set<string>();

  for (const item of module.items) {
    const title = item.title.trim();
    if (!title) {
      continue;
    }

    const subtitle = item.subtitle?.trim();
    const key = `${title.toLowerCase()}|${(subtitle ?? "").toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push({ title, subtitle: subtitle || undefined });
    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}
