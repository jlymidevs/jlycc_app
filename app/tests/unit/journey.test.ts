// app/tests/unit/journey.test.ts
import { describe, it, expect } from "vitest";
import {
  nextStage,
  isHeadEligible,
  nextFreePriority,
  type StageRow,
} from "@/lib/journey";

const LADDER: StageRow[] = [
  { stageCode: "FTV", name: "First Time Visitor", orderIndex: 10, isTerminal: false },
  { stageCode: "OGV", name: "Ongoing Visitor", orderIndex: 20, isTerminal: false },
  { stageCode: "RA", name: "Regular Attendee", orderIndex: 30, isTerminal: false },
  { stageCode: "REGULAR_MEMBER", name: "Regular Member", orderIndex: 40, isTerminal: false },
  { stageCode: "JOSHUA_GENERATION", name: "Joshua Generation", orderIndex: 50, isTerminal: false },
  { stageCode: "INNER_CORE", name: "Inner Core", orderIndex: 60, isTerminal: false },
  { stageCode: "DFL", name: "Drop From List", orderIndex: 99, isTerminal: true },
];

describe("nextStage", () => {
  it("returns the next non-terminal stage", () => {
    expect(nextStage(LADDER, "REGULAR_MEMBER")?.stageCode).toBe("JOSHUA_GENERATION");
    expect(nextStage(LADDER, "JOSHUA_GENERATION")?.stageCode).toBe("INNER_CORE");
  });

  it("returns null at the top of the ladder", () => {
    expect(nextStage(LADDER, "INNER_CORE")).toBeNull();
  });

  it("returns null for terminal or unknown stages", () => {
    expect(nextStage(LADDER, "DFL")).toBeNull();
    expect(nextStage(LADDER, "NOPE")).toBeNull();
  });
});

describe("isHeadEligible", () => {
  it("Inner Core and Joshua Generation are eligible", () => {
    expect(isHeadEligible("INNER_CORE")).toBe(true);
    expect(isHeadEligible("JOSHUA_GENERATION")).toBe(true);
  });

  it("everyone else is not", () => {
    expect(isHeadEligible("REGULAR_MEMBER")).toBe(false);
    expect(isHeadEligible("FTV")).toBe(false);
  });
});

describe("nextFreePriority", () => {
  it("returns 1 when nothing is taken", () => {
    expect(nextFreePriority([])).toBe(1);
  });

  it("returns the lowest free rank", () => {
    expect(nextFreePriority([1, 2])).toBe(3);
    expect(nextFreePriority([2, 3])).toBe(1);
    expect(nextFreePriority([1, 3])).toBe(2);
  });
});
