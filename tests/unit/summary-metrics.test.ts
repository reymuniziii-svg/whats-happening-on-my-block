import { findModule, summaryMetrics, topModuleItems } from "@/lib/brief/summary-metrics";
import type { BriefResponse } from "@/types/brief";

const briefFixture: BriefResponse = {
  input: {
    normalized_address: "350 5 AVENUE, New York, NY, USA",
  },
  location: {
    lat: 40.748441,
    lon: -73.985656,
  },
  updated_at_utc: "2026-02-20T12:00:00.000Z",
  parameters: {
    radius_primary_m: 150,
    radius_secondary_m: 400,
    window_30d: "2026-01-21T12:00:00.000Z",
    window_90d: "2025-11-22T12:00:00.000Z",
  },
  modules: [
    {
      id: "right_now",
      headline: "Active disruption strip",
      status: "ok",
      stats: [
        { label: "Active closures", value: 2 },
        { label: "Active street works", value: 1 },
        { label: "Active film permits", value: 0 },
      ],
      items: [{ title: "Closure A", source_dataset_id: "i6b5-j7bu" }],
      methodology: "test",
      sources: [],
    },
    {
      id: "collisions",
      headline: "Crash trends",
      status: "ok",
      stats: [
        { label: "Crashes (90d)", value: 9 },
        { label: "Injuries (90d)", value: 3 },
      ],
      items: [],
      methodology: "test",
      sources: [],
    },
    {
      id: "311_pulse",
      headline: "311 trends",
      status: "ok",
      stats: [{ label: "Requests (30d)", value: "84" }],
      items: [
        { title: "Noise", source_dataset_id: "erm2-nwe9" },
        { title: "Blocked Driveway", source_dataset_id: "erm2-nwe9" },
      ],
      methodology: "test",
      sources: [],
    },
    {
      id: "events",
      headline: "Events",
      status: "ok",
      stats: [{ label: "Upcoming events", value: 4 }],
      items: [],
      methodology: "test",
      sources: [],
    },
    {
      id: "dob_permits",
      headline: "n/a",
      status: "ok",
      stats: [],
      items: [],
      methodology: "test",
      sources: [],
    },
    {
      id: "street_works",
      headline: "n/a",
      status: "ok",
      stats: [],
      items: [],
      methodology: "test",
      sources: [],
    },
    {
      id: "sanitation",
      headline: "n/a",
      status: "ok",
      stats: [],
      items: [],
      methodology: "test",
      sources: [],
    },
    {
      id: "film",
      headline: "n/a",
      status: "ok",
      stats: [],
      items: [],
      methodology: "test",
      sources: [],
    },
  ],
  map: {
    center: { lat: 40.748441, lon: -73.985656 },
    radius_primary_m: 150,
    radius_secondary_m: 400,
    features: [],
  },
};

describe("summary metrics helpers", () => {
  it("builds key summary metrics from module stats", () => {
    const metrics = summaryMetrics(briefFixture);
    expect(metrics.activeDisruptions).toBe(3);
    expect(metrics.crashes90d).toBe(9);
    expect(metrics.injuries90d).toBe(3);
    expect(metrics.requests30d).toBe(84);
    expect(metrics.upcomingEvents).toBe(4);
  });

  it("returns top items for module lists", () => {
    const moduleData = findModule(briefFixture, "311_pulse");
    expect(topModuleItems(moduleData, 1)).toEqual([{ title: "Noise", subtitle: undefined }]);
  });

  it("deduplicates repeating title/subtitle rows", () => {
    const moduleData = findModule(briefFixture, "right_now");
    if (!moduleData) {
      throw new Error("Expected right_now module in fixture");
    }

    moduleData.items = [
      { title: "Same Title", subtitle: "Same Subtitle", source_dataset_id: "i6b5-j7bu" },
      { title: "Same Title", subtitle: "Same Subtitle", source_dataset_id: "i6b5-j7bu" },
      { title: "Same Title", subtitle: "Different", source_dataset_id: "i6b5-j7bu" },
      { title: "Next Title", source_dataset_id: "i6b5-j7bu" },
    ];

    expect(topModuleItems(moduleData, 4)).toEqual([
      { title: "Same Title", subtitle: "Same Subtitle" },
      { title: "Same Title", subtitle: "Different" },
      { title: "Next Title", subtitle: undefined },
    ]);
  });
});
