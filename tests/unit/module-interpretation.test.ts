import { interpretModule } from "@/lib/insights/module-interpretation";
import type { Module } from "@/types/brief";

function makeModule(overrides: Partial<Module>): Module {
  return {
    id: "right_now",
    headline: "test",
    status: "ok",
    stats: [],
    items: [],
    methodology: "test",
    sources: [],
    ...overrides,
  };
}

describe("module interpretation", () => {
  it("classifies right_now low when no active disruptions", () => {
    const moduleData = makeModule({
      id: "right_now",
      stats: [
        { label: "Active closures", value: 0 },
        { label: "Active street works", value: 0 },
        { label: "Active film permits", value: 0 },
      ],
    });

    const interpretation = interpretModule(moduleData);
    expect(interpretation.severity).toBe("low");
    expect(interpretation.thresholdNote).toContain("Low: 0 active disruptions");
  });

  it("classifies right_now high when active disruptions are elevated", () => {
    const moduleData = makeModule({
      id: "right_now",
      stats: [
        { label: "Active closures", value: 1 },
        { label: "Active street works", value: 2 },
        { label: "Active film permits", value: 1 },
      ],
    });

    const interpretation = interpretModule(moduleData);
    expect(interpretation.severity).toBe("high");
  });

  it("uses 311 thresholds for medium/high escalation", () => {
    const moduleData = makeModule({
      id: "311_pulse",
      stats: [{ label: "Requests (30d)", value: 220, delta: 70 }],
    });

    const interpretation = interpretModule(moduleData);
    expect(interpretation.severity).toBe("medium");
  });

  it("bumps partial modules to at least medium", () => {
    const moduleData = makeModule({
      id: "film",
      status: "partial",
      stats: [
        { label: "Upcoming permits", value: 0 },
        { label: "Active now", value: 0 },
      ],
    });

    const interpretation = interpretModule(moduleData);
    expect(interpretation.severity).toBe("medium");
  });

  it("defaults unavailable modules to high uncertainty", () => {
    const moduleData = makeModule({
      id: "events",
      status: "unavailable",
    });

    const interpretation = interpretModule(moduleData);
    expect(interpretation.severity).toBe("high");
    expect(interpretation.impact).toContain("temporarily unavailable");
  });
});
