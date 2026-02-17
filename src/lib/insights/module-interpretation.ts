import type { Module } from "@/types/brief";

export type SeverityLevel = "low" | "medium" | "high";

export interface ModuleInterpretation {
  severity: SeverityLevel;
  severityLabel: "Low" | "Medium" | "High";
  impact: string;
  thresholdNote: string;
}

interface ThresholdDecision {
  severity: SeverityLevel;
  impact: string;
  thresholdNote: string;
}

function levelOrder(level: SeverityLevel): number {
  if (level === "low") {
    return 0;
  }
  if (level === "medium") {
    return 1;
  }
  return 2;
}

function maxLevel(...levels: SeverityLevel[]): SeverityLevel {
  let selected: SeverityLevel = "low";
  for (const level of levels) {
    if (levelOrder(level) > levelOrder(selected)) {
      selected = level;
    }
  }
  return selected;
}

function toSeverityLabel(level: SeverityLevel): "Low" | "Medium" | "High" {
  if (level === "low") {
    return "Low";
  }
  if (level === "medium") {
    return "Medium";
  }
  return "High";
}

function statValue(module: Module, label: string): string | number | undefined {
  return module.stats.find((stat) => stat.label === label)?.value;
}

function statNumber(module: Module, label: string): number {
  const value = statValue(module, label);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function statDelta(module: Module, label: string): number {
  const value = module.stats.find((stat) => stat.label === label)?.delta;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function classifyByThreshold(value: number, mediumMin: number, highMin: number): SeverityLevel {
  if (value >= highMin) {
    return "high";
  }
  if (value >= mediumMin) {
    return "medium";
  }
  return "low";
}

function rightNowDecision(module: Module): ThresholdDecision {
  const activeTotal =
    statNumber(module, "Active closures") + statNumber(module, "Active street works") + statNumber(module, "Active film permits");
  const severity = classifyByThreshold(activeTotal, 1, 3);

  const impact =
    severity === "low"
      ? "No immediate disruption signal. Typical travel and curb access conditions are likely right now."
      : severity === "medium"
        ? "Expect localized slowdowns or parking friction near active work areas today."
        : "Multiple active disruptions are likely to affect travel time, curb access, or street circulation now.";

  return {
    severity,
    impact,
    thresholdNote: "Low: 0 active disruptions. Medium: 1-2. High: 3+.",
  };
}

function dobDecision(module: Module): ThresholdDecision {
  const permits = statNumber(module, "DOB permits (90d)");
  const complaints = statNumber(module, "DOB complaints (90d)");
  const violations = statNumber(module, "ECB violations (12m)");

  const permitsLevel = classifyByThreshold(permits, 15, 35);
  const complaintsLevel = classifyByThreshold(complaints, 10, 25);
  const violationsLevel = classifyByThreshold(violations, 5, 12);
  const severity = maxLevel(permitsLevel, complaintsLevel, violationsLevel);

  const impact =
    severity === "low"
      ? "Recent construction pressure looks limited. Fewer signs of sustained permit and complaint activity nearby."
      : severity === "medium"
        ? "Moderate construction activity may create intermittent noise, access, or complaint pressure."
        : "High construction and enforcement signal suggests recurring neighborhood disruption risk.";

  return {
    severity,
    impact,
    thresholdNote:
      "High if any: permits 35+, complaints 25+, or violations 12+. Medium if any: permits 15+, complaints 10+, or violations 5+.",
  };
}

function streetWorksDecision(module: Module): ThresholdDecision {
  const activeTotal = statNumber(module, "Active street works") + statNumber(module, "Active closures");
  const severity = classifyByThreshold(activeTotal, 2, 5);

  const impact =
    severity === "low"
      ? "Street operations are relatively quiet. Near-term road impacts appear limited."
      : severity === "medium"
        ? "Plan for occasional route changes, lane friction, or curb limitations."
        : "High chance of recurring traffic friction and route detours in this area.";

  return {
    severity,
    impact,
    thresholdNote: "Low: 0-1 active street disruptions. Medium: 2-4. High: 5+.",
  };
}

function collisionsDecision(module: Module): ThresholdDecision {
  const crashes = statNumber(module, "Crashes (90d)");
  const injuries = statNumber(module, "Injuries (90d)");

  const crashesLevel = classifyByThreshold(crashes, 15, 40);
  const injuriesLevel = classifyByThreshold(injuries, 3, 8);
  const severity = maxLevel(crashesLevel, injuriesLevel);

  const impact =
    severity === "low"
      ? "Recent crash and injury counts are comparatively low for this radius."
      : severity === "medium"
        ? "Use extra caution at nearby intersections; collision activity is notable."
        : "Elevated recent crash and injury signal indicates higher roadway safety risk nearby.";

  return {
    severity,
    impact,
    thresholdNote: "High if injuries 8+ or crashes 40+. Medium if injuries 3+ or crashes 15+.",
  };
}

function pulse311Decision(module: Module): ThresholdDecision {
  const requests = statNumber(module, "Requests (30d)");
  const delta = Math.max(0, statDelta(module, "Requests (30d)"));

  const requestsLevel = classifyByThreshold(requests, 150, 350);
  const trendLevel = classifyByThreshold(delta, 50, 120);
  const severity = maxLevel(requestsLevel, trendLevel);

  const impact =
    severity === "low"
      ? "311 pressure is steady to light, with fewer signs of broad neighborhood strain."
      : severity === "medium"
        ? "Service issues are active and may affect quality-of-life conditions."
        : "High and/or sharply rising complaint volume points to concentrated neighborhood stress.";

  return {
    severity,
    impact,
    thresholdNote: "High if requests 350+ or 30d increase 120+. Medium if requests 150+ or increase 50+.",
  };
}

function sanitationDecision(module: Module): ThresholdDecision {
  const hasUnavailableStat = module.stats.some((stat) => String(stat.value).toUpperCase() === "N/A");

  if (module.status === "unavailable") {
    return {
      severity: "high",
      impact: "Sanitation frequency could not be verified right now; curb planning confidence is low.",
      thresholdNote: "Unavailable sanitation module defaults to High uncertainty.",
    };
  }

  if (hasUnavailableStat || module.status === "partial") {
    return {
      severity: "medium",
      impact: "Service frequency is partly resolved; treat pickup expectations as approximate.",
      thresholdNote: "Medium when any collection frequency is missing or module status is partial.",
    };
  }

  return {
    severity: "low",
    impact: "Area service frequency is available, useful for routine curb and disposal planning.",
    thresholdNote: "Low when all frequency fields are present.",
  };
}

function eventsDecision(module: Module): ThresholdDecision {
  const eventCount = statNumber(module, "Upcoming events");
  const severity = classifyByThreshold(eventCount, 8, 20);

  const impact =
    severity === "low"
      ? "Limited upcoming permitted event activity is expected in this local area."
      : severity === "medium"
        ? "Expect periodic local event activity that may affect foot traffic and curb use."
        : "Dense upcoming event activity could create sustained crowding, parking, or circulation impacts.";

  return {
    severity,
    impact,
    thresholdNote: "Low: 0-7 locally relevant events. Medium: 8-19. High: 20+.",
  };
}

function filmDecision(module: Module): ThresholdDecision {
  const upcoming = statNumber(module, "Upcoming permits");
  const activeNow = statNumber(module, "Active now");

  const upcomingLevel = classifyByThreshold(upcoming, 5, 15);
  const activeLevel = classifyByThreshold(activeNow, 1, 3);
  const severity = maxLevel(upcomingLevel, activeLevel);

  const impact =
    severity === "low"
      ? "Film-related curb and traffic impact appears limited in the near term."
      : severity === "medium"
        ? "Some parking and lane constraints are possible around film activity windows."
        : "Frequent or active film permits may significantly affect parking and street operations.";

  return {
    severity,
    impact,
    thresholdNote: "High if active now 3+ or upcoming permits 15+. Medium if active now 1+ or upcoming permits 5+.",
  };
}

function decisionForModule(module: Module): ThresholdDecision {
  switch (module.id) {
    case "right_now":
      return rightNowDecision(module);
    case "dob_permits":
      return dobDecision(module);
    case "street_works":
      return streetWorksDecision(module);
    case "collisions":
      return collisionsDecision(module);
    case "311_pulse":
      return pulse311Decision(module);
    case "sanitation":
      return sanitationDecision(module);
    case "events":
      return eventsDecision(module);
    case "film":
      return filmDecision(module);
    default:
      return {
        severity: "low",
        impact: "No interpretation available.",
        thresholdNote: "No threshold configured.",
      };
  }
}

export function interpretModule(module: Module): ModuleInterpretation {
  if (module.status === "unavailable") {
    return {
      severity: "high",
      severityLabel: "High",
      impact: "This module is temporarily unavailable, so current local conditions cannot be confirmed.",
      thresholdNote: "Unavailable modules default to High uncertainty until data recovers.",
    };
  }

  const decision = decisionForModule(module);
  const severity = module.status === "partial" ? maxLevel(decision.severity, "medium") : decision.severity;

  return {
    severity,
    severityLabel: toSeverityLabel(severity),
    impact: decision.impact,
    thresholdNote: decision.thresholdNote,
  };
}
