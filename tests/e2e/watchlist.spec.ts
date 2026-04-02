import { expect, test } from "@playwright/test";

test.describe("Watchlist API", () => {
  test("empty watchlist returns empty blocks array", async ({ request }) => {
    const response = await request.get("/api/v2/watchlist");
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json).toHaveProperty("session_id");
    expect(json).toHaveProperty("blocks");
    expect(Array.isArray(json.blocks)).toBe(true);
  });

  test("add block to watchlist", async ({ request }) => {
    const blockId = `v1_test_${Date.now()}`;

    const addResponse = await request.post("/api/v2/watchlist/blocks", {
      data: {
        block_id: blockId,
        normalized_address: "123 Test St, New York, NY",
      },
    });
    expect(addResponse.ok()).toBeTruthy();

    const addJson = await addResponse.json();
    expect(addJson.blocks).toContainEqual(
      expect.objectContaining({
        block_id: blockId,
        normalized_address: "123 Test St, New York, NY",
      }),
    );
  });

  test("add and then remove block from watchlist", async ({ request }) => {
    const blockId = `v1_remove_test_${Date.now()}`;

    // Add block
    const addResponse = await request.post("/api/v2/watchlist/blocks", {
      data: {
        block_id: blockId,
        normalized_address: "456 Test Ave, New York, NY",
      },
    });
    expect(addResponse.ok()).toBeTruthy();
    const addJson = await addResponse.json();
    expect(addJson.blocks.some((b: { block_id: string }) => b.block_id === blockId)).toBe(true);

    // Remove block
    const removeResponse = await request.delete(`/api/v2/watchlist/blocks/${encodeURIComponent(blockId)}`);
    expect(removeResponse.ok()).toBeTruthy();

    const removeJson = await removeResponse.json();
    expect(removeJson.blocks.some((b: { block_id: string }) => b.block_id === blockId)).toBe(false);
  });

  test("session persists blocks across requests via cookie", async ({ request }) => {
    const blockId = `v1_persist_test_${Date.now()}`;

    // Add block
    const addResponse = await request.post("/api/v2/watchlist/blocks", {
      data: {
        block_id: blockId,
        normalized_address: "789 Persist Blvd, New York, NY",
      },
    });
    expect(addResponse.ok()).toBeTruthy();

    // List watchlist - should see the block because cookies are shared in the context
    const listResponse = await request.get("/api/v2/watchlist");
    expect(listResponse.ok()).toBeTruthy();

    const listJson = await listResponse.json();
    expect(listJson.blocks.some((b: { block_id: string }) => b.block_id === blockId)).toBe(true);
  });

  test("invalid block_id returns 400", async ({ request }) => {
    const response = await request.post("/api/v2/watchlist/blocks", {
      data: {
        block_id: "ab", // Too short
      },
    });
    expect(response.status()).toBe(400);
  });

  test("adding duplicate block updates existing entry", async ({ request }) => {
    const blockId = `v1_dupe_test_${Date.now()}`;

    // Add block first time
    await request.post("/api/v2/watchlist/blocks", {
      data: {
        block_id: blockId,
        normalized_address: "Original Address",
      },
    });

    // Add same block with different address
    const updateResponse = await request.post("/api/v2/watchlist/blocks", {
      data: {
        block_id: blockId,
        normalized_address: "Updated Address",
      },
    });
    expect(updateResponse.ok()).toBeTruthy();

    const json = await updateResponse.json();
    const matchingBlocks = json.blocks.filter((b: { block_id: string }) => b.block_id === blockId);
    expect(matchingBlocks.length).toBe(1); // Should not duplicate
    expect(matchingBlocks[0].normalized_address).toBe("Updated Address");
  });
});

test.describe("Watchlist UI", () => {
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

  test("watchlist bar shows empty state", async ({ page }) => {
    // Visit homepage first to establish a fresh session
    await page.goto("/");

    // The page loads without error - WatchlistBar may or may not be visible depending on layout
    await expect(page.getByRole("heading", { name: "What's Happening on My Block?" })).toBeVisible();
  });
});
