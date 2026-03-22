import type { ModuleFreshness } from "@/types/brief-v2";

interface ModuleFreshnessBadgeProps {
  freshness?: ModuleFreshness;
}

export function ModuleFreshnessBadge({ freshness }: ModuleFreshnessBadgeProps) {
  if (!freshness) {
    return null;
  }

  const refreshedLabel = new Date(freshness.refreshed_at_utc).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <span className="module-freshness-badge" title={`Revalidates every ${freshness.revalidate_seconds} seconds`}>
      Updated {refreshedLabel}
    </span>
  );
}
