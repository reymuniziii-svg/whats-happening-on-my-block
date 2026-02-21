import { findModule, summaryMetrics, topModuleItems } from "@/lib/brief/summary-metrics";
import type { BriefResponse } from "@/types/brief";

interface WeeklyDigestStripProps {
  brief: BriefResponse;
}

function uniqueTitles(items: Array<{ title: string; subtitle?: string }>, limit: number): Array<{ title: string; subtitle?: string }> {
  const unique: Array<{ title: string; subtitle?: string }> = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = item.title.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

export function WeeklyDigestStrip({ brief }: WeeklyDigestStripProps) {
  const metrics = summaryMetrics(brief);
  const rightNowItems = uniqueTitles(topModuleItems(findModule(brief, "right_now"), 12), 3);
  const pulseItems = uniqueTitles(topModuleItems(findModule(brief, "311_pulse"), 12), 3);

  return (
    <section className="weekly-digest" aria-label="Weekly digest">
      <header>
        <p className="eyebrow">Weekly digest mode</p>
        <h2>Quick share view for the last 7 days</h2>
      </header>

      <div className="weekly-digest-stats" role="list">
        <div role="listitem" className="weekly-digest-stat">
          <span>Active disruptions</span>
          <strong>{metrics.activeDisruptions}</strong>
        </div>
        <div role="listitem" className="weekly-digest-stat">
          <span>311 requests (30d)</span>
          <strong>{metrics.requests30d}</strong>
        </div>
        <div role="listitem" className="weekly-digest-stat">
          <span>Crashes / injuries (90d)</span>
          <strong>
            {metrics.crashes90d} / {metrics.injuries90d}
          </strong>
        </div>
        <div role="listitem" className="weekly-digest-stat">
          <span>Upcoming events</span>
          <strong>{metrics.upcomingEvents}</strong>
        </div>
      </div>

      <div className="weekly-digest-lists">
        <div>
          <h3>Right now highlights</h3>
          <ul>
            {rightNowItems.length > 0 ? rightNowItems.map((item) => <li key={`digest-now-${item.title}`}>{item.title}</li>) : <li>No active disruptions reported.</li>}
          </ul>
        </div>

        <div>
          <h3>Top 311 complaint types</h3>
          <ul>
            {pulseItems.length > 0 ? pulseItems.map((item) => <li key={`digest-311-${item.title}`}>{item.title}</li>) : <li>No recent dominant complaint type.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
