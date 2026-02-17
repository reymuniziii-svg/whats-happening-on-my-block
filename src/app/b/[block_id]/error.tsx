"use client";

import Link from "next/link";

export default function BriefErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="content-page">
      <p className="eyebrow">Temporary Error</p>
      <h1>We could not render this brief right now.</h1>
      <p>The route is still available. Try again now or start a new search.</p>
      <p>
        <button type="button" className="share-button" onClick={() => reset()}>
          Try Again
        </button>
      </p>
      <p>
        <Link href="/">Back to search</Link>
      </p>
    </main>
  );
}
