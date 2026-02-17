import pLimit from "p-limit";

const BASE_URL = "https://data.cityofnewyork.us/resource";
const concurrencyLimit = pLimit(4);

export interface SodaQuery {
  select?: string;
  where?: string;
  order?: string;
  limit?: number;
  group?: string;
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

export async function sodaFetch<T>(datasetId: string, query: SodaQuery): Promise<T[]> {
  return concurrencyLimit(async () => {
    const queryString = toQueryString(query);
    const url = `${BASE_URL}/${datasetId}.json?${queryString}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (process.env.SOCRATA_APP_TOKEN) {
      headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(url, {
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`SODA ${datasetId} failed (${response.status}): ${body.slice(0, 240)}`);
      }

      return (await response.json()) as T[];
    } finally {
      clearTimeout(timeout);
    }
  });
}
