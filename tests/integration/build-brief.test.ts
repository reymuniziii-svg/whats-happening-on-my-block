import { MODULE_ORDER } from "@/config/modules";
import { buildBrief } from "@/lib/brief/build-brief";
import type { ModuleBuilder } from "@/lib/modules/types";
import type { ModuleId, ResolvedLocation } from "@/types/brief";

function makeStubBuilder(id: ModuleId): ModuleBuilder {
  return {
    id,
    build: async () => ({
      id,
      headline: `${id} headline`,
      status: "ok",
      stats: [{ label: "count", value: 1 }],
      items: [
        {
          title: `${id} item`,
          source_dataset_id: "h9gi-nx95",
          lat: 40.7484,
          lon: -73.9857,
        },
      ],
      methodology: "test method",
      sources: [
        {
          dataset_id: "h9gi-nx95",
          dataset_name: "Motor Vehicle Collisions - Crashes",
          dataset_url: "https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95",
        },
      ],
    }),
  };
}

describe("buildBrief integration", () => {
  it("gracefully degrades when one module fails", async () => {
    const overrides: Partial<Record<ModuleId, ModuleBuilder>> = {};

    for (const id of MODULE_ORDER) {
      overrides[id] = makeStubBuilder(id);
    }

    overrides.collisions = {
      id: "collisions",
      build: async () => {
        throw new Error("Simulated dataset outage");
      },
    };

    const location: ResolvedLocation = {
      normalized_address: "350 5 AVENUE, New York, NY, USA",
      geocoder: "geosearch",
      lat: 40.748441,
      lon: -73.985664,
      bbl: "1008350041",
      bin: "1015862",
      borough: "Manhattan",
      community_district: "5",
      council_district: "4",
      zip_code: "10118",
    };

    const brief = await buildBrief({ location }, overrides);

    expect(brief.modules).toHaveLength(MODULE_ORDER.length);
    const collisions = brief.modules.find((m) => m.id === "collisions");
    expect(collisions?.status).toBe("unavailable");
    expect(collisions?.warnings?.[0]).toContain("Simulated dataset outage");

    const okModules = brief.modules.filter((m) => m.status === "ok");
    expect(okModules.length).toBe(MODULE_ORDER.length - 1);
    expect(brief.map.features.length).toBeGreaterThan(0);
  });
});
