import type { ModuleId } from "@/types/brief";

interface MetricCounter {
  count: number;
  totalMs: number;
  maxMs: number;
}

const routeLatency = new Map<string, MetricCounter>();
const moduleLatency = new Map<ModuleId, MetricCounter>();

function bump(counterMap: Map<string, MetricCounter>, key: string, elapsedMs: number): void {
  const current = counterMap.get(key) ?? { count: 0, totalMs: 0, maxMs: 0 };
  current.count += 1;
  current.totalMs += elapsedMs;
  current.maxMs = Math.max(current.maxMs, elapsedMs);
  counterMap.set(key, current);
}

export function recordRouteTiming(route: string, elapsedMs: number): void {
  bump(routeLatency, route, elapsedMs);
}

export function recordModuleTiming(moduleId: ModuleId, elapsedMs: number): void {
  bump(moduleLatency as unknown as Map<string, MetricCounter>, moduleId, elapsedMs);
}

export function metricsSnapshot() {
  return {
    routes: Object.fromEntries(routeLatency.entries()),
    modules: Object.fromEntries(moduleLatency.entries()),
  };
}
