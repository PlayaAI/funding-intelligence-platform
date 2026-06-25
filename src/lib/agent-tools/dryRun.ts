import type { DryRunPlan } from "./types";

export function buildDryRunPlan<T extends Record<string, unknown>>(
  plannedMutation: T,
  targetPersistenceTables: string[],
  extra: Record<string, unknown> = {}
): DryRunPlan<T> & Record<string, unknown> {
  return {
    dryRun: true,
    mutationPerformed: false,
    wouldTouchRealDb: true,
    targetPersistenceTables,
    relatedTables: targetPersistenceTables,
    plannedMutation,
    ...extra,
  };
}
