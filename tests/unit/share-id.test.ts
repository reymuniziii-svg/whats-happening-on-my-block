import { decodeBlockId, encodeBlockId } from "@/lib/brief/share-id";

describe("share block id", () => {
  it("encodes and decodes deterministically", () => {
    const blockId = encodeBlockId({
      lat: 40.7484411,
      lon: -73.9856649,
      bbl: "1008350041",
      bin: "1015862",
      borough: "Manhattan",
      normalized_address: "350 5 AVENUE, New York, NY, USA",
      community_district: "5",
      council_district: "4",
      zip_code: "10118",
    });

    const decoded = decodeBlockId(blockId);

    expect(decoded.v).toBe(1);
    expect(decoded.lat).toBe(40.74844);
    expect(decoded.lon).toBe(-73.98566);
    expect(decoded.bbl).toBe("1008350041");
    expect(decoded.bin).toBe("1015862");
    expect(decoded.borough).toBe("Manhattan");
  });

  it("rejects unsupported version", () => {
    expect(() => decodeBlockId("v2_abc")).toThrow("Unsupported block id version");
  });
});
