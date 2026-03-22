import { expect, test } from "@playwright/test";

test("digest cron endpoint is protected", async ({ request }) => {
  const response = await request.post("/api/internal/cron/digest");
  expect(response.status()).toBe(401);
});
