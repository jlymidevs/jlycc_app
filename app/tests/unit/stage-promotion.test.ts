import { describe, expect, it } from "vitest";
import { nextPromotionStage } from "@/lib/stage-promotion";

describe("nextPromotionStage", () => {
  it("steps REGULAR_MEMBER -> JOSHUA_GENERATION -> INNER_CORE", () => {
    expect(nextPromotionStage("REGULAR_MEMBER")).toBe("JOSHUA_GENERATION");
    expect(nextPromotionStage("JOSHUA_GENERATION")).toBe("INNER_CORE");
  });
  it("returns null at the top and for non-promotable stages", () => {
    expect(nextPromotionStage("INNER_CORE")).toBeNull();
    expect(nextPromotionStage("FTV")).toBeNull();
    expect(nextPromotionStage("DFL")).toBeNull();
  });
});
