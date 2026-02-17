import Link from "next/link";
import { notFound } from "next/navigation";
import { buildBrief } from "@/lib/brief/build-brief";
import { decodeBlockId } from "@/lib/brief/share-id";
import { MapPanel } from "@/components/MapPanel";
import { ModuleCard } from "@/components/ModuleCard";
import { ShareButton } from "@/components/ShareButton";
import type { BriefResponse, ResolvedLocation } from "@/types/brief";

export const runtime = "nodejs";
export const maxDuration = 60;

interface BriefPageProps {
  params: Promise<{ block_id: string }>;
}

export default async function BriefPage({ params }: BriefPageProps) {
  const { block_id } = await params;

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
  try {
    brief = await buildBrief({ location });
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
          <a href={`/api/brief/by-block/${block_id}`}>Open raw brief JSON</a>
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
          <Link href="/">New Search</Link>
          <Link href="/methodology">Methodology</Link>
        </div>
      </header>

      <MapPanel map={brief.map} />

      <section className="module-stack" aria-label="Modules">
        {brief.modules.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </section>
    </main>
  );
}
