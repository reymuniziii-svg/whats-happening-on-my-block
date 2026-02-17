export function nowUtcIso(): string {
  return new Date().toISOString();
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function daysAheadIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function toIsoOrUndefined(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function durationDays(startIso?: string, endIso?: string): number {
  if (!startIso || !endIso) {
    return 0;
  }
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }
  return Math.max(1, Math.round((end - start) / 86400000));
}
