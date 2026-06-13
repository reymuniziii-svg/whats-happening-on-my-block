import Link from "next/link";
import { notFound } from "next/navigation";
import { buildBriefV2 } from "@/lib/brief/build-brief-v2";
import { decodeBlockId } from "@/lib/brief/share-id";
import { BriefInteractivePanels } from "@/components/BriefInteractivePanels";
import { PublishTools } from "@/components/PublishTools";
import { ShareButton } from "@/components/ShareButton";
import { SummaryCardButton } from "@/components/SummaryCardButton";
import { WeeklyDigestStrip } from "@/components/WeeklyDigestStrip";
import { WatchlistBar } from "@/components/WatchlistBar";
import type { BriefResponse, ResolvedLocation } from "@/types/brief";
import type { BriefResponseV2 } from "@/types/brief-v2";

export const runtime = "nodejs";
export const maxDuration = 60;

interface BriefPageProps {
  params: Promise<{ block_id: string }>;
  searchParams: Promise<{ lens?: string; mode?: string }>;
}

function toTimeLens(value?: string): "now" | "24h" | "7d" | "30d" {
  if (value === "now" || value === "24h" || value === "7d" || value === "30d") {
    return value;
  }
  return "30d";
}

export default async function BriefPage({ params, searchParams }: BriefPageProps) {
  const { block_id } = await params;
  const query = await searchParams;
  const initialTimeLens = toTimeLens(query.lens);
  const weeklyMode = query.mode === "weekly";

  let location: ResolvedLocation;
  try {
    const payload = decodeBlockId(block_id);
    location = {
      normalized_address: payload.normalized_address ?? `${payload.lat}, ${payload.lon}`,
      geocoder: "geosearch",
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
  let briefV2: BriefResponseV2;
  try {
    briefV2 = await buildBriefV2({ location });
    brief = briefV2.brief;
  } catch {
    return (
      <main className="content-page">
        <p className="eyebrow">Temporary Issue</p>
        <h1>Block brief is loading slower than expected.</h1>
        <p>
          The page is up, but live data aggregation failed for this request. Please refresh in a few seconds, or use the API endpoint
          directly.
        </p>
        <p>
          <a href={`/api/v2/brief/by-block/${block_id}`}>Open raw brief JSON</a>
        </p>
        <p>
          <Link href="/">Back to search</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="brief-page">
      <header className="brief-header">
        <div>
          <p className="eyebrow">Block Brief</p>
          <h1>{brief.input.normalized_address}</h1>
          <p className="updated-at">Last updated: {new Date(brief.updated_at_utc).toLocaleString("en-US", { timeZone: "UTC" })} UTC</p>
          <p className="location-meta">
            {[brief.location.borough, brief.location.community_district ? `CD ${brief.location.community_district}` : undefined]
              .filter(Boolean)
              .join(" | ")}
          </p>
        </div>

        <div className="header-actions">
          <ShareButton path={`/b/${block_id}`} />
          <SummaryCardButton brief={brief} path={`/b/${block_id}`} />
          <PublishTools blockId={block_id} />
          <Link href="/">New Search</Link>
          <Link href="/methodology">Methodology</Link>
        </div>
      </header>

      {weeklyMode ? <WeeklyDigestStrip brief={brief} /> : null}
      <WatchlistBar currentBlockId={block_id} currentAddress={brief.input.normalized_address} />
      <BriefInteractivePanels
        brief={brief}
        blockId={block_id}
        initialTimeLens={initialTimeLens}
        moduleFreshness={briefV2.module_freshness}
      />
    </main>
  );
}
