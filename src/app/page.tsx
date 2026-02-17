import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";

export default function HomePage() {
  return (
    <main className="landing-page">
      <div className="hero-wrap">
        <p className="eyebrow">NYC Block Brief</p>
        <h1>What&apos;s Happening on My Block?</h1>
        <p className="hero-text">
          Enter a NYC address and get a fast public brief on current disruptions, safety signals, sanitation frequency, and nearby events.
        </p>

        <SearchForm />

        <p className="hero-note">
          Transparent by design: each module links directly to NYC Open Data and explains exactly how it is calculated.
        </p>

        <nav className="hero-links" aria-label="Site links">
          <Link href="/about">About</Link>
          <Link href="/methodology">Methodology</Link>
        </nav>
      </div>
    </main>
  );
}
