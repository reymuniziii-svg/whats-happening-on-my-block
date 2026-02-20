import Link from "next/link";
import { notFound } from "next/navigation";
import { buildBrief } from "@/lib/brief/build-brief";
import { decodeBlockId } from "@/lib/brief/share-id";
import { findModule, summaryMetrics, topModuleItems } from "@/lib/brief/summary-metrics";
import type { BriefResponse, ResolvedLocation } from "@/types/brief";

export const runtime = "nodejs";
export const maxDuration = 60;

interface EmbedPageProps {
  params: Promise<{ block_id: string }>;
}

export default async function EmbedPage({ params }: EmbedPageProps) {
  const { block_id } = await params;

  let location: ResolvedLocation;
  try {
    const payload = decodeBlockId(block_id);
    location = {
      normalized_address: payload.normalized_address ?? `${payload.lat}, ${payload.lon}`,
      geocoder: "geosearch",
      confidence: undefined,
      lat: payload.lat,
      lon: payload.lon,
      bbl: payload.bbl,
      bin: payload.bin,
      borough: payload.borough,
      community_district: payload.community_district,
      council_district: payload.council_district,
      zip_code: payload.zip_code,
    };
  } catch {
    notFound();
  }

  let brief: BriefResponse;
  try {
    brief = await buildBrief({ location });
  } catch {
    return (
      <main className="embed-page">
        <section className="embed-card">
          <p>Widget temporarily unavailable. Please refresh.</p>
        </section>
      </main>
    );
  }

  const metrics = summaryMetrics(brief);
  const highlights = topModuleItems(findModule(brief, "right_now"), 2);

  return (
    <main className="embed-page">
      <section className="embed-card" aria-label="NYC Block Brief widget">
        <p className="embed-kicker">NYC Block Brief</p>
        <h1>{brief.input.normalized_address}</h1>
        <p className="embed-updated">Updated {new Date(brief.updated_at_utc).toLocaleString("en-US", { timeZone: "UTC" })} UTC</p>

        <div className="embed-stats" role="list">
          <div role="listitem">
            <span>Disruptions now</span>
            <strong>{metrics.activeDisruptions}</strong>
          </div>
          <div role="listitem">
            <span>311 requests</span>
            <strong>{metrics.requests30d}</strong>
          </div>
          <div role="listitem">
            <span>Crashes / injuries</span>
            <strong>
              {metrics.crashes90d} / {metrics.injuries90d}
            </strong>
          </div>
        </div>

        <ul className="embed-list">
          {highlights.length > 0 ? highlights.map((item) => <li key={`embed-highlight-${item.title}`}>{item.title}</li>) : <li>No active disruption highlights.</li>}
        </ul>

        <p className="embed-footer">
          <Link href={`/b/${block_id}`} target="_blank">
            Open full block brief
          </Link>
        </p>
      </section>
    </main>
  );
}
