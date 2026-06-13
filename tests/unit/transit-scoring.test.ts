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

  it("maps numeric GTFS effect codes correctly and does not invert severity", () => {
    const stations = [
      {
        station_id: "A12",
        station_name: "Main St",
        lat: 40.7,
        lon: -73.9,
        distance_m: 200,
        aliases: ["A12"],
      },
    ];

    // Production stores effect as String(numericEnum). NO_SERVICE=1 is high impact;
    // NO_EFFECT=10 must never outrank it (regression test for the inverted-severity bug).
    const ranked = rankTransitAlerts(
      [
        { id: "no-service", headline: "No service", stop_ids: ["A12"], route_ids: [], effect: "1" },
        { id: "no-effect", headline: "No effect", stop_ids: ["A12"], route_ids: [], effect: "10" },
      ],
      stations,
      new Date().toISOString(),
    );

    const noService = ranked.find((entry) => entry.alert.id === "no-service");
    const noEffect = ranked.find((entry) => entry.alert.id === "no-effect");

    expect(noService?.severity).toBe("high");
    expect(noEffect?.severity).not.toBe("high");
    expect(noService?.score ?? 0).toBeGreaterThan(noEffect?.score ?? 0);
  });
});
