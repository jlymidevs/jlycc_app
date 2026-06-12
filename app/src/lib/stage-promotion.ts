// Ministry-head promotion ladder. Only these two hops are allowed;
// earlier stages (FTV/OGV/RA) move through the normal membership flow.
const PROMOTION_LADDER: Record<string, string> = {
  REGULAR_MEMBER: "JOSHUA_GENERATION",
  JOSHUA_GENERATION: "INNER_CORE",
};

export function nextPromotionStage(current: string): string | null {
  return PROMOTION_LADDER[current] ?? null;
}
