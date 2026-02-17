import { andClauses, pointInPolygon, withinCircle } from "@/lib/soda/query-builders";

describe("query builders", () => {
  it("joins clauses with AND", () => {
    expect(andClauses("a=1", undefined, "b=2")).toBe("a=1 AND b=2");
  });

  it("creates within_circle clause", () => {
    expect(withinCircle("location", 40.7, -73.9, 400)).toBe("within_circle(location, 40.7, -73.9, 400)");
  });

  it("creates point in polygon clause", () => {
    expect(pointInPolygon("multipolygon", -73.9857, 40.7484)).toContain("intersects(multipolygon");
    expect(pointInPolygon("multipolygon", -73.9857, 40.7484)).toContain("POINT (-73.9857 40.7484)");
  });
});
