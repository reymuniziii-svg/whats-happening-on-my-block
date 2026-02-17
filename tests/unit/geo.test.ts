import { bboxForRadius, distancePointToLineMeters, parseWktLineStringToLatLon } from "@/lib/utils/geo";

describe("geo utils", () => {
  it("builds a bounding box for radius", () => {
    const bbox = bboxForRadius(40.7484, -73.9857, 400);
    expect(bbox.minLat).toBeLessThan(40.7484);
    expect(bbox.maxLat).toBeGreaterThan(40.7484);
    expect(bbox.minLon).toBeLessThan(-73.9857);
    expect(bbox.maxLon).toBeGreaterThan(-73.9857);
  });

  it("parses WKT linestring from EPSG:2263 to lat/lon", () => {
    const line = parseWktLineStringToLatLon(
      "LINESTRING (988696.95620000362 173835.03740000725, 988815.952000007 173603.05619999766)",
    );

    expect(line.length).toBe(2);
    expect(line[0][0]).toBeGreaterThan(40);
    expect(line[0][0]).toBeLessThan(41);
    expect(line[0][1]).toBeLessThan(-73);
  });

  it("computes point-to-line distance", () => {
    const line: Array<[number, number]> = [
      [40.7484, -73.986],
      [40.7484, -73.984],
    ];

    const distance = distancePointToLineMeters(40.7484, -73.985, line);
    expect(distance).toBeLessThan(5);
  });
});
