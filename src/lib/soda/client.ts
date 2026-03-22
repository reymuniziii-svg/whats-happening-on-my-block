import pLimit from "p-limit";

const BASE_URL = "https://data.cityofnewyork.us/resource";
const concurrencyLimit = pLimit(4);
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_RETRIES = 1;
const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 45_000;
const MODULE_QUERY_BUDGET = 8;

interface CircuitState {
  failures: number;
  openUntil?: number;
}

const datasetCircuit = new Map<string, CircuitState>();
const moduleBudget = new Map<string, { count: number; resetAt: number }>();

export interface SodaQuery {
  select?: string;
  where?: string;
  order?: string;
  limit?: number;
  group?: string;
}

export interface SodaFetchOptions {
  cacheSeconds?: number;
  timeoutMs?: number;
  retries?: number;
  budgetKey?: string;
}

function toQueryString(query: SodaQuery): string {
  const params = new URLSearchParams();
  if (query.select) params.set("$select", query.select);
  if (query.where) params.set("$where", query.where);
  if (query.order) params.set("$order", query.order);
  if (query.group) params.set("$group", query.group);
  params.set("$limit", String(query.limit ?? 1000));
  return params.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.toLowerCase().includes("abort");
  }
  return false;
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("network")
  );
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function assertBudget(budgetKey?: string): void {
  if (!budgetKey) {
    return;
  }

  const now = Date.now();
  const current = moduleBudget.get(budgetKey);
  if (!current || now > current.resetAt) {
    moduleBudget.set(budgetKey, { count: 1, resetAt: now + 60_000 });
    return;
  }

  if (current.count >= MODULE_QUERY_BUDGET) {
    throw new Error(`SODA query budget exceeded for ${budgetKey} (${MODULE_QUERY_BUDGET}/minute)`);
  }

  current.count += 1;
  moduleBudget.set(budgetKey, current);
}

function assertCircuit(datasetId: string): void {
  const state = datasetCircuit.get(datasetId);
  if (!state || !state.openUntil) {
    return;
  }

  if (Date.now() < state.openUntil) {
    throw new Error(`SODA ${datasetId} temporarily paused due to repeated upstream failures`);
  }
}

function markCircuitSuccess(datasetId: string): void {
  datasetCircuit.set(datasetId, { failures: 0 });
}

function markCircuitFailure(datasetId: string): void {
  const current = datasetCircuit.get(datasetId) ?? { failures: 0 };
  const failures = current.failures + 1;

  if (failures >= CIRCUIT_FAIL_THRESHOLD) {
    datasetCircuit.set(datasetId, {
      failures,
      openUntil: Date.now() + CIRCUIT_OPEN_MS,
    });
    return;
  }

  datasetCircuit.set(datasetId, {
    failures,
  });
}

export async function sodaFetch<T>(datasetId: string, query: SodaQuery, options: SodaFetchOptions = {}): Promise<T[]> {
  return concurrencyLimit(async () => {
    assertBudget(options.budgetKey);
    assertCircuit(datasetId);

    const queryString = toQueryString(query);
    const url = `${BASE_URL}/${datasetId}.json?${queryString}`;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retries = options.retries ?? DEFAULT_RETRIES;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (process.env.SOCRATA_APP_TOKEN) {
      headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          headers,
          // Use Next's data cache to reduce SODA load and improve serverless reliability.
          cache: "force-cache",
          next: {
            revalidate: options.cacheSeconds ?? 300,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          const error = new Error(`SODA ${datasetId} failed (${response.status}): ${body.slice(0, 240)}`);
          lastError = error;
          if (attempt < retries && isRetriableStatus(response.status)) {
            await sleep(250 * (attempt + 1));
            continue;
          }
          throw error;
        }

        const data = (await response.json()) as T[];
        markCircuitSuccess(datasetId);
        return data;
      } catch (error) {
        const aborted = isAbortError(error);
        if (aborted) {
          lastError = new Error(`SODA ${datasetId} timed out after ${timeoutMs}ms`);
        } else if (error instanceof Error) {
          lastError = error;
        } else {
          lastError = new Error(`SODA ${datasetId} failed with unknown error`);
        }

        const canRetry = aborted || isTransientNetworkError(error);
        if (attempt < retries && canRetry) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        markCircuitFailure(datasetId);
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error(`SODA ${datasetId} failed`);
  });
}
