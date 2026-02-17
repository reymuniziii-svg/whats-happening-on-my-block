"use client";

import Link from "next/link";

export default function GlobalErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="content-page">
      <p className="eyebrow">Temporary Error</p>
      <h1>The app is up, but this request failed.</h1>
      <p>Please retry. If it keeps failing, use the health endpoint to confirm service status.</p>
      <p>
        <a href="/api/health">Open /api/health</a>
      </p>
      <p>
        <button type="button" className="share-button" onClick={() => reset()}>
          Retry
        </button>
      </p>
      <p>
        <Link href="/">Back to search</Link>
      </p>
    </main>
  );
}
