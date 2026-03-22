import { prisma, prismaEnabled } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export interface WatchlistBlockRecord {
  block_id: string;
  normalized_address?: string;
  sort_order: number;
  created_at_utc: string;
}

interface MemoryWatchlistEntry {
  block_id: string;
  normalized_address?: string;
  sort_order: number;
  created_at_utc: string;
}

const memoryWatchlists = new Map<string, MemoryWatchlistEntry[]>();

function memoryList(sessionId: string): WatchlistBlockRecord[] {
  return [...(memoryWatchlists.get(sessionId) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

function memoryUpsert(sessionId: string, blockId: string, normalizedAddress?: string): WatchlistBlockRecord[] {
  const current = memoryList(sessionId);
  const existing = current.find((entry) => entry.block_id === blockId);

  if (existing) {
    const next = current.map((entry) =>
      entry.block_id === blockId
        ? {
            ...entry,
            normalized_address: normalizedAddress ?? entry.normalized_address,
          }
        : entry,
    );
    memoryWatchlists.set(sessionId, next);
    return next;
  }

  const next = [
    ...current,
    {
      block_id: blockId,
      normalized_address: normalizedAddress,
      sort_order: current.length,
      created_at_utc: new Date().toISOString(),
    },
  ];

  memoryWatchlists.set(sessionId, next);
  return next;
}

function memoryRemove(sessionId: string, blockId: string): WatchlistBlockRecord[] {
  const current = memoryList(sessionId).filter((entry) => entry.block_id !== blockId);
  const normalized = current.map((entry, index) => ({
    ...entry,
    sort_order: index,
  }));
  memoryWatchlists.set(sessionId, normalized);
  return normalized;
}

async function listBlocksFromDb(sessionId: string): Promise<WatchlistBlockRecord[]> {
  const watchlist = await prisma.watchlist.findUnique({
    where: { sessionId },
    include: {
      blocks: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!watchlist) {
    return [];
  }

  return watchlist.blocks.map((block) => ({
    block_id: block.blockId,
    normalized_address: block.normalizedAddress ?? undefined,
    sort_order: block.sortOrder,
    created_at_utc: block.createdAt.toISOString(),
  }));
}

async function ensureWatchlist(sessionId: string): Promise<string> {
  const watchlist = await prisma.watchlist.upsert({
    where: { sessionId },
    update: {},
    create: { sessionId },
  });

  return watchlist.id;
}

async function upsertBlockInDb(sessionId: string, blockId: string, normalizedAddress?: string): Promise<WatchlistBlockRecord[]> {
  const watchlistId = await ensureWatchlist(sessionId);

  const count = await prisma.watchlistBlock.count({
    where: {
      watchlistId,
    },
  });

  await prisma.watchlistBlock.upsert({
    where: {
      watchlistId_blockId: {
        watchlistId,
        blockId,
      },
    },
    update: {
      normalizedAddress,
    },
    create: {
      watchlistId,
      blockId,
      normalizedAddress,
      sortOrder: count,
    },
  });

  return listBlocksFromDb(sessionId);
}

async function removeBlockInDb(sessionId: string, blockId: string): Promise<WatchlistBlockRecord[]> {
  const watchlist = await prisma.watchlist.findUnique({
    where: { sessionId },
  });

  if (!watchlist) {
    return [];
  }

  await prisma.watchlistBlock.deleteMany({
    where: {
      watchlistId: watchlist.id,
      blockId,
    },
  });

  const current = await prisma.watchlistBlock.findMany({
    where: {
      watchlistId: watchlist.id,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  for (let index = 0; index < current.length; index += 1) {
    const item = current[index];
    if (item.sortOrder !== index) {
      await prisma.watchlistBlock.update({
        where: { id: item.id },
        data: { sortOrder: index },
      });
    }
  }

  return listBlocksFromDb(sessionId);
}

function memoryAllTrackedBlocks(): Array<{ session_id: string; block_id: string; normalized_address?: string }> {
  return [...memoryWatchlists.entries()].flatMap(([session_id, blocks]) =>
    blocks.map((block) => ({
      session_id,
      block_id: block.block_id,
      normalized_address: block.normalized_address,
    })),
  );
}

export async function listWatchlistBlocks(sessionId: string): Promise<WatchlistBlockRecord[]> {
  if (!prismaEnabled()) {
    return memoryList(sessionId);
  }

  try {
    return await listBlocksFromDb(sessionId);
  } catch (error) {
    logger.warn({ error }, "listWatchlistBlocks fell back to memory");
    return memoryList(sessionId);
  }
}

export async function addWatchlistBlock(
  sessionId: string,
  blockId: string,
  normalizedAddress?: string,
): Promise<WatchlistBlockRecord[]> {
  if (!prismaEnabled()) {
    return memoryUpsert(sessionId, blockId, normalizedAddress);
  }

  try {
    return await upsertBlockInDb(sessionId, blockId, normalizedAddress);
  } catch (error) {
    logger.warn({ error }, "addWatchlistBlock fell back to memory");
    return memoryUpsert(sessionId, blockId, normalizedAddress);
  }
}

export async function removeWatchlistBlock(sessionId: string, blockId: string): Promise<WatchlistBlockRecord[]> {
  if (!prismaEnabled()) {
    return memoryRemove(sessionId, blockId);
  }

  try {
    return await removeBlockInDb(sessionId, blockId);
  } catch (error) {
    logger.warn({ error }, "removeWatchlistBlock fell back to memory");
    return memoryRemove(sessionId, blockId);
  }
}

export async function listAllTrackedBlocks(): Promise<Array<{ session_id: string; block_id: string; normalized_address?: string }>> {
  if (!prismaEnabled()) {
    return memoryAllTrackedBlocks();
  }

  try {
    const rows = await prisma.watchlistBlock.findMany({
      include: {
        watchlist: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return rows.map((row) => ({
      session_id: row.watchlist.sessionId,
      block_id: row.blockId,
      normalized_address: row.normalizedAddress ?? undefined,
    }));
  } catch (error) {
    logger.warn({ error }, "listAllTrackedBlocks fell back to memory");
    return memoryAllTrackedBlocks();
  }
}
