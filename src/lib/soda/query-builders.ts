export function andClauses(...clauses: Array<string | undefined | null | false>): string {
  const filtered = clauses.filter((clause): clause is string => Boolean(clause && clause.trim()));
  return filtered.join(" AND ");
}

export function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function withinCircle(field: string, lat: number, lon: number, radiusMeters: number): string {
  return `within_circle(${field}, ${lat}, ${lon}, ${radiusMeters})`;
}

export function betweenIso(field: string, startIso: string, endIso?: string): string {
  if (endIso) {
    return `${field} between ${quote(startIso)} and ${quote(endIso)}`;
  }
  return `${field} >= ${quote(startIso)}`;
}

export function inValues(field: string, values: string[]): string | undefined {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (!cleaned.length) {
    return undefined;
  }
  return `${field} in (${cleaned.map((value) => quote(value)).join(", ")})`;
}

export function boroughPredicate(field: string, borough?: string): string | undefined {
  if (!borough) {
    return undefined;
  }
  return `upper(${field}) = ${quote(borough.toUpperCase())}`;
}

export function bblPredicate(field: string, bbl?: string): string | undefined {
  if (!bbl) {
    return undefined;
  }
  return `${field} = ${quote(bbl)}`;
}

export function binPredicate(field: string, bin?: string): string | undefined {
  if (!bin) {
    return undefined;
  }
  return `${field} = ${quote(bin)}`;
}

export function isNotNull(field: string): string {
  return `${field} is not null`;
}

export function pointInPolygon(field: string, lon: number, lat: number): string {
  return `intersects(${field}, ${quote(`POINT (${lon} ${lat})`)})`;
}
