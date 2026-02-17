"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SearchForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"address" | "bbl">("address");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(`Enter a ${mode}.`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const query = mode === "address" ? `address=${encodeURIComponent(trimmed)}` : `bbl=${encodeURIComponent(trimmed)}`;
      const response = await fetch(`/api/brief?${query}`);
      const json = (await response.json()) as { error?: string; share_path?: string };

      if (!response.ok || !json.share_path) {
        throw new Error(json.error ?? "Could not generate a brief for this location.");
      }

      router.push(json.share_path);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to search this location.");
      setLoading(false);
    }
  }

  return (
    <form className="search-form" onSubmit={onSubmit}>
      <div className="mode-row" role="radiogroup" aria-label="Search mode">
        <button
          className={mode === "address" ? "mode-chip active" : "mode-chip"}
          type="button"
          onClick={() => setMode("address")}
          aria-pressed={mode === "address"}
        >
          Address
        </button>
        <button
          className={mode === "bbl" ? "mode-chip active" : "mode-chip"}
          type="button"
          onClick={() => setMode("bbl")}
          aria-pressed={mode === "bbl"}
        >
          BBL
        </button>
      </div>

      <label htmlFor="query-input" className="search-label">
        {mode === "address" ? "NYC address" : "Borough-Block-Lot (10 digits)"}
      </label>
      <div className="search-input-row">
        <input
          id="query-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={mode === "address" ? "e.g., 350 5th Ave, Manhattan" : "e.g., 1008350041"}
          autoComplete="off"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Build Brief"}
        </button>
      </div>

      {error ? <p className="search-error">{error}</p> : null}
    </form>
  );
}
