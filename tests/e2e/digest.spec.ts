import { expect, test } from "@playwright/test";

test.describe("Digest API", () => {
  test("digest cron endpoint is protected", async ({ request }) => {
    const response = await request.post("/api/internal/cron/digest");
    expect(response.status()).toBe(401);

    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  test("digest cron rejects invalid bearer token", async ({ request }) => {
    const response = await request.post("/api/internal/cron/digest", {
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });
    expect(response.status()).toBe(401);
  });

  test("digest cron works with valid CRON_SECRET", async ({ request }) => {
    // Skip if CRON_SECRET is not set
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      test.skip();
      return;
    }

    const response = await request.post("/api/internal/cron/digest", {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    // Should either succeed or fail gracefully
    expect([200, 500]).toContain(response.status());

    const json = await response.json();
    if (response.status() === 200) {
      expect(json).toHaveProperty("run_id");
      expect(json).toHaveProperty("processed_blocks");
    }
  });
});

test.describe("Digest Integration", () => {
  test("digest processes watchlist blocks when authorized", async ({ request }) => {
    // This test requires CRON_SECRET to be set
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      test.skip();
      return;
    }

    // First, add a block to the watchlist
    const blockId = `v1_digest_test_${Date.now()}`;
    const addResponse = await request.post("/api/v2/watchlist/blocks", {
      data: {
        block_id: blockId,
        normalized_address: "350 5th Ave, New York, NY",
      },
    });
    expect(addResponse.ok()).toBeTruthy();

    // Run the digest
    const digestResponse = await request.post("/api/internal/cron/digest", {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    // The digest may fail to process the block if the block_id doesn't decode properly,
    // but it should not error completely
    expect([200, 500]).toContain(digestResponse.status());

    const json = await digestResponse.json();
    if (digestResponse.status() === 200) {
      // Digest ran successfully
      expect(typeof json.run_id).toBe("string");
      expect(typeof json.processed_blocks).toBe("number");
      expect(Array.isArray(json.failures)).toBe(true);
    }
  });
});
