import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";

function hasFfmpeg(): boolean {
  const check = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return check.status === 0;
}

async function main() {
  const submissionDir = path.resolve(process.cwd(), "submission");
  const videoTmpDir = path.resolve(process.cwd(), ".tmp-video");

  await fs.mkdir(submissionDir, { recursive: true });
  await fs.mkdir(videoTmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    recordVideo: {
      dir: videoTmpDir,
      size: { width: 430, height: 932 },
    },
  });

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByLabel("NYC address").fill("350 5th Ave, New York, NY");
  await page.getByRole("button", { name: "Build Brief" }).click();
  await page.waitForURL(/\/b\/v1_/, { timeout: 90_000 });
  await page.waitForTimeout(5_000);

  const video = page.video();
  await context.close();
  await browser.close();

  if (!video) {
    throw new Error("No video recording available.");
  }

  const webmPath = path.join(submissionDir, "demo.webm");
  const sourcePath = await video.path();
  await fs.copyFile(sourcePath, webmPath);

  if (hasFfmpeg()) {
    const gifPath = path.join(submissionDir, "demo.gif");
    const result = spawnSync(
      "ffmpeg",
      ["-y", "-i", webmPath, "-vf", "fps=10,scale=430:-1:flags=lanczos", "-loop", "0", gifPath],
      { stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error("ffmpeg conversion to GIF failed.");
    }
    console.log(`Saved demo GIF to ${gifPath}`);
  } else {
    console.log(`ffmpeg unavailable; saved demo video to ${webmPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
