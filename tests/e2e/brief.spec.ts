import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What's Happening on My Block?" })).toBeVisible();
  await expect(page.getByLabel("NYC address")).toBeVisible();
});

test("invalid block id shows not found", async ({ page }) => {
  await page.goto("/b/not-valid");
  await expect(page.getByRole("heading", { name: "Block brief link is invalid." })).toBeVisible();
});

test("address search creates a shareable brief", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/");
  await page.getByLabel("NYC address").fill("350 5th Ave, New York, NY");
  await page.getByRole("button", { name: "Build Brief" }).click();

  await page.waitForURL(/\/b\/v1_/);
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(page.locator("section.module-card").first()).toBeVisible();
});
