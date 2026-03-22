"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface WatchlistBlock {
  block_id: string;
  normalized_address?: string;
  sort_order: number;
  created_at_utc: string;
}

interface WatchlistResponse {
  session_id: string;
  blocks: WatchlistBlock[];
  error?: string;
}

interface WatchlistBarProps {
  currentBlockId?: string;
  currentAddress?: string;
}

const LOCAL_STORAGE_KEY = "whomb_watchlist";

function readLocalBlocks(): WatchlistBlock[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as WatchlistBlock[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((row) => typeof row.block_id === "string");
  } catch {
    return [];
  }
}

function writeLocalBlocks(blocks: WatchlistBlock[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(blocks));
}

export function WatchlistBar({ currentBlockId, currentAddress }: WatchlistBarProps) {
  const [blocks, setBlocks] = useState<WatchlistBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBlocks(readLocalBlocks());

    let mounted = true;
    setLoading(true);

    fetch("/api/v2/watchlist")
      .then(async (response) => {
        const json = (await response.json()) as WatchlistResponse;
        if (!response.ok) {
          throw new Error(json.error ?? "Could not load watchlist.");
        }
        return json;
      })
      .then((json) => {
        if (!mounted) {
          return;
        }
        setBlocks(json.blocks);
        writeLocalBlocks(json.blocks);
      })
      .catch((fetchError) => {
        if (!mounted) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Could not load watchlist.");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const currentSaved = useMemo(
    () => Boolean(currentBlockId && blocks.some((block) => block.block_id === currentBlockId)),
    [blocks, currentBlockId],
  );

  async function addCurrentBlock() {
    if (!currentBlockId || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/v2/watchlist/blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          block_id: currentBlockId,
          normalized_address: currentAddress,
        }),
      });

      const json = (await response.json()) as WatchlistResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Could not save this block.");
      }

      setBlocks(json.blocks);
      writeLocalBlocks(json.blocks);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not save this block.");
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(blockId: string) {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/v2/watchlist/blocks/${encodeURIComponent(blockId)}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as WatchlistResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Could not remove this block.");
      }

      setBlocks(json.blocks);
      writeLocalBlocks(json.blocks);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove this block.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="watchlist-bar" aria-label="Saved blocks">
      <div className="watchlist-header">
        <h2>Saved blocks</h2>
        {currentBlockId ? (
          <button type="button" onClick={addCurrentBlock} disabled={saving || currentSaved}>
            {currentSaved ? "Saved" : saving ? "Saving..." : "Save this block"}
          </button>
        ) : null}
      </div>

      {error ? <p className="watchlist-error">{error}</p> : null}
      {loading && blocks.length === 0 ? <p className="watchlist-note">Loading saved blocks...</p> : null}

      {blocks.length > 0 ? (
        <ul className="watchlist-list">
          {blocks.map((block) => (
            <li key={block.block_id}>
              <Link href={`/b/${block.block_id}`}>{block.normalized_address || block.block_id}</Link>
              <button type="button" onClick={() => removeBlock(block.block_id)} disabled={saving}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="watchlist-note">No blocks saved yet.</p>
      )}
    </section>
  );
}
