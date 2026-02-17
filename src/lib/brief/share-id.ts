import { z } from "zod";

const blockPayloadSchema = z.object({
  v: z.literal(1),
  lat: z.number(),
  lon: z.number(),
  bbl: z.string().optional(),
  bin: z.string().optional(),
  borough: z.string().optional(),
  normalized_address: z.string().optional(),
  community_district: z.string().optional(),
  council_district: z.string().optional(),
  zip_code: z.string().optional(),
});

export type BlockIdPayload = z.infer<typeof blockPayloadSchema>;

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base.length % 4 === 0 ? "" : "=".repeat(4 - (base.length % 4));
  return Buffer.from(base + pad, "base64").toString("utf8");
}

export function encodeBlockId(payload: Omit<BlockIdPayload, "v">): string {
  const canonical = {
    v: 1 as const,
    lat: Number(payload.lat.toFixed(5)),
    lon: Number(payload.lon.toFixed(5)),
    bbl: payload.bbl,
    bin: payload.bin,
    borough: payload.borough,
    normalized_address: payload.normalized_address,
    community_district: payload.community_district,
    council_district: payload.council_district,
    zip_code: payload.zip_code,
  };
  return `v1_${toBase64Url(JSON.stringify(canonical))}`;
}

export function decodeBlockId(blockId: string): BlockIdPayload {
  if (!blockId.startsWith("v1_")) {
    throw new Error("Unsupported block id version");
  }
  const encoded = blockId.slice(3);
  const raw = fromBase64Url(encoded);
  const parsed = JSON.parse(raw);
  return blockPayloadSchema.parse(parsed);
}
