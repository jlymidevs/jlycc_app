// app/src/lib/journey.ts
// Pure helpers for the christian-journey stage ladder and ministry priorities.

export interface StageRow {
  stageCode: string;
  name: string;
  orderIndex: number;
  isTerminal: boolean;
}

const HEAD_ELIGIBLE_STAGES = new Set(["INNER_CORE", "JOSHUA_GENERATION"]);

/** Next non-terminal stage above the current one, or null at the top. */
export function nextStage(
  ladder: StageRow[],
  currentStageCode: string
): StageRow | null {
  const current = ladder.find((s) => s.stageCode === currentStageCode);
  if (!current || current.isTerminal) return null;
  const above = ladder
    .filter((s) => !s.isTerminal && s.orderIndex > current.orderIndex)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return above[0] ?? null;
}

/** Only Inner Core / Joshua Generation members may be appointed ministry head. */
export function isHeadEligible(stageCode: string): boolean {
  return HEAD_ELIGIBLE_STAGES.has(stageCode);
}

/** Lowest positive rank not present in `taken`. */
export function nextFreePriority(taken: number[]): number {
  const set = new Set(taken);
  let p = 1;
  while (set.has(p)) p++;
  return p;
}
