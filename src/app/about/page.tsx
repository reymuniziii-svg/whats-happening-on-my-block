import Link from "next/link";

export const metadata = {
  title: "About | What's Happening on My Block?",
};

export default function AboutPage() {
  return (
    <main className="content-page">
      <header>
        <p className="eyebrow">About</p>
        <h1>What this project is</h1>
      </header>

      <p>
        What&apos;s Happening on My Block? is a public NYC neighborhood signal tool. It combines construction, street work, collisions,
        311 trends, sanitation service frequency, events, and film permits into one practical block brief.
      </p>
      <p>
        The goal is utility in 10 seconds: clear status cards, plain-English summaries, and source links for every module. The app is
        designed for residents, community organizers, and anyone trying to quickly understand local block conditions.
      </p>
      <p>
        This project is built on NYC Open Data using server-side SODA queries, resilient partial rendering, and transparent methodology
        notes so users can understand both the result and its limitations.
      </p>

      <p>
        <Link href="/">Back to search</Link> | <Link href="/methodology">View methodology</Link>
      </p>
    </main>
  );
}
