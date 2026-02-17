import { DATASETS, type DatasetId } from "@/config/datasets";
import type { Module, ModuleId, ModuleSource, ModuleStatus } from "@/types/brief";

export function moduleSources(ids: DatasetId[]): ModuleSource[] {
  return ids.map((id) => ({
    dataset_id: id,
    dataset_name: DATASETS[id].name,
    dataset_url: DATASETS[id].url,
  }));
}

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function moduleSkeleton(
  id: ModuleId,
  headline: string,
  sources: ModuleSource[],
  methodology: string,
  status: ModuleStatus = "ok",
): Module {
  return {
    id,
    headline,
    status,
    stats: [],
    items: [],
    methodology,
    sources,
  };
}

export function unavailableModule(
  id: ModuleId,
  headline: string,
  sources: ModuleSource[],
  methodology: string,
  warning: string,
): Module {
  return {
    id,
    headline,
    status: "unavailable",
    stats: [
      {
        label: "Status",
        value: "Data temporarily unavailable",
      },
    ],
    items: [],
    methodology,
    sources,
    warnings: [warning],
  };
}
