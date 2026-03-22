import { addWatchlistBlock, listWatchlistBlocks, removeWatchlistBlock } from "@/lib/watchlist/service";

describe("watchlist service", () => {
  it("adds and removes blocks in fallback memory mode", async () => {
    const sessionId = `test-session-${Date.now()}`;

    const added = await addWatchlistBlock(sessionId, "v1_test_block", "Test Address");
    expect(added.length).toBe(1);
    expect(added[0]?.block_id).toBe("v1_test_block");

    const listed = await listWatchlistBlocks(sessionId);
    expect(listed.length).toBe(1);

    const removed = await removeWatchlistBlock(sessionId, "v1_test_block");
    expect(removed.length).toBe(0);
  });
});
