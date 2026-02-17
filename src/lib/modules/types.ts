import type { Module, ModuleId, ResolvedLocation } from "@/types/brief";

export interface ModuleBuildContext {
  location: ResolvedLocation;
  radiusPrimaryM: number;
  radiusSecondaryM: number;
  window30dIso: string;
  window90dIso: string;
  window12mIso: string;
  nowIso: string;
  blockKey: string;
}

export interface ModuleBuilder {
  id: ModuleId;
  build: (context: ModuleBuildContext) => Promise<Module>;
}
