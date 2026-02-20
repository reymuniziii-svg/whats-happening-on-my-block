import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "About | What's Happening on My Block?",
};

export default function AboutPage() {
  return (
    <main className="content-page about-page">
      <section className="about-section">
        <h2>About the Project</h2>
        <div className="about-card-grid">
          <article className="about-card">
            <h3>Purpose</h3>
            <p>
              What&apos;s Happening on My Block? helps people quickly understand what is happening near a NYC address right now:
              construction and street disruption, safety trends, 311 pressure, sanitation patterns, and nearby events.
            </p>
          </article>

          <article className="about-card">
            <h3>How It Works</h3>
            <p>
              The app normalizes location using NYC geocoding, then queries NYC Open Data through the Socrata SODA API and assembles one
              transparent brief with module-level methods, source links, and graceful fallbacks.
            </p>
          </article>

          <article className="about-card">
            <h3>What Makes It Useful</h3>
            <p>
              The design is built for a 10-second read: concise cards, plain-English impact framing, severity tags, and optional deeper
              views (like full 311 call lists) when users want details.
            </p>
          </article>
        </div>

        <p className="about-link-row">
          Project repository:{" "}
          <a href="https://github.com/reymuniziii-svg/whats-happening-on-my-block" target="_blank" rel="noreferrer">
            github.com/reymuniziii-svg/whats-happening-on-my-block
          </a>
        </p>
      </section>

      <section className="about-section">
        <h2>About the Builder</h2>
        <article className="builder-card">
          <div className="builder-photo">
            <Image
              src="/reynaldo-muniz-headshot.png"
              alt="Portrait of Reynaldo Muniz"
              width={260}
              height={260}
              sizes="(max-width: 780px) 180px, 260px"
            />
          </div>

          <div className="builder-copy">
            <h3 className="builder-name">Reynaldo Muniz</h3>
            <p className="builder-placeholder">
              I build tools and write things that make messy data legible and complex topics clearer. By day, strategic
              communications for good causes. By night, tech projects, criterion collection, and writing. Brooklyn based. Bills guy
              (for better or worse).
            </p>

            <p className="builder-links">
              <a href="https://github.com/reymuniziii-svg" target="_blank" rel="noreferrer">
                GitHub
              </a>{" "}
              ·{" "}
              <a href="https://reynaldomuniz.substack.com/" target="_blank" rel="noreferrer">
                Substack
              </a>{" "}
              ·{" "}
              <a href="https://www.linkedin.com/in/reynaldomuniz/" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </p>
          </div>
        </article>
      </section>

      <p className="about-nav-links">
        <Link href="/">Back to search</Link> | <Link href="/methodology">View methodology</Link>
      </p>
    </main>
  );
}
