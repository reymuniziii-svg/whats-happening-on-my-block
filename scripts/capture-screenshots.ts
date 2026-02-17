import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function getSharePath(address: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/brief?address=${encodeURIComponent(address)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch brief API: ${response.status}`);
  }
  const json = (await response.json()) as { share_path?: string };
  if (!json.share_path) {
    throw new Error("share_path missing from API response");
  }
  return json.share_path;
}

async function main() {
  const submissionDir = path.resolve(process.cwd(), "submission");
  await fs.mkdir(submissionDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.screenshot({ path: path.join(submissionDir, "hero-1.png"), fullPage: false });

  const sharePath = await getSharePath("350 5th Ave, New York, NY");

  const mobile = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await mobile.goto(`${baseUrl}${sharePath}`, { waitUntil: "networkidle" });
  await mobile.screenshot({ path: path.join(submissionDir, "hero-2.png"), fullPage: false });

  await browser.close();

  console.log(`Saved screenshots to ${submissionDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
