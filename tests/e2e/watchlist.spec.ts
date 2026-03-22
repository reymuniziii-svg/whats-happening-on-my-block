import { expect, test } from "@playwright/test";

test.skip("user can save a block to watchlist from brief page", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/");
  await page.getByLabel("NYC address").fill("350 5th Ave, New York, NY");
  await page.getByRole("button", { name: "Build Brief" }).click();

  await page.waitForURL(/\/b\/v1_/);

  const saveButton = page.getByRole("button", { name: /Save this block|Saved/ });
  await expect(saveButton).toBeVisible();
  const label = (await saveButton.textContent()) ?? "";
  if (label.toLowerCase().includes("save this block")) {
    await saveButton.click();
  }

  await expect(page.getByRole("button", { name: /Saved|Save this block/ })).toBeVisible();
  await expect(page.locator(".watchlist-list li").first()).toBeVisible();
});
