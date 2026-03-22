import { MODULE_ORDER } from "@/config/modules";
import { buildBriefV2 } from "@/lib/brief/build-brief-v2";
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
      items: [],
      methodology: "test",
      sources: [],
    }),
  };
}

describe("v2 brief payload", () => {
  it("returns additive diagnostics while preserving brief response", async () => {
    const overrides: Partial<Record<ModuleId, ModuleBuilder>> = {};
    for (const id of MODULE_ORDER) {
      overrides[id] = makeStubBuilder(id);
    }

    overrides.transit_mobility = {
      id: "transit_mobility",
      build: async () => {
        throw new Error("simulated transit failure");
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

    const response = await buildBriefV2({ location }, overrides);

    expect(response.version).toBe("2");
    expect(response.brief.modules.length).toBe(MODULE_ORDER.length);
    expect(response.module_fetch_ms.transit_mobility).toBeTypeOf("number");
    expect(response.data_quality_flags.some((flag) => flag.includes("transit_mobility:unavailable"))).toBe(true);
  });
});
