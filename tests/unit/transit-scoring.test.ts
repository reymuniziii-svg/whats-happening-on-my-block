import { rankTransitAlerts } from "@/lib/transit/scoring";

describe("transit scoring", () => {
  it("prioritizes alerts that match nearby stations", () => {
    const ranked = rankTransitAlerts(
      [
        {
          id: "a-1",
          headline: "Station disruption",
          stop_ids: ["A12"],
          route_ids: [],
          effect: "NO_SERVICE",
        },
        {
          id: "a-2",
          headline: "General advisory",
          stop_ids: ["Z99"],
          route_ids: [],
          effect: "OTHER_EFFECT",
        },
      ],
      [
        {
          station_id: "A12",
          station_name: "Main St",
          lat: 40.7,
          lon: -73.9,
          distance_m: 200,
          aliases: ["A12"],
        },
      ],
      new Date().toISOString(),
    );

    expect(ranked[0]?.alert.id).toBe("a-1");
    expect(ranked[0]?.severity).toBe("high");
  });
});
