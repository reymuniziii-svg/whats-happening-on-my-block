import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="content-page">
      <p className="eyebrow">Not Found</p>
      <h1>Block brief link is invalid.</h1>
      <p>The share URL could not be decoded. Run a new search to generate a valid brief link.</p>
      <p>
        <Link href="/">Go to search</Link>
      </p>
    </main>
  );
}
