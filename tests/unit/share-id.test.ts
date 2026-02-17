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

  it("supports legacy payloads that used norough key", () => {
    const legacyPayload = {
      v: 1,
      lat: 40.68434,
      lon: -73.92316,
      bbl: "3016680051",
      bin: "3046670",
      norough: "Brooklyn",
      normalized_address: "166 RALPH AVENUE, Brooklyn, NY, USA",
      zip_code: "11233",
    };

    const encoded = Buffer.from(JSON.stringify(legacyPayload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const decoded = decodeBlockId(`v1_${encoded}`);
    expect(decoded.borough).toBe("Brooklyn");
  });
});
