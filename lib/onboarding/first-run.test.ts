import { describe, expect, it } from "vitest";
import {
  computeFirstRun,
  tripsHaveAnyExpense,
} from "@/lib/onboarding/first-run";
import type { AutomationUiState } from "@/lib/onboarding/automation-ui-state";

const UI: AutomationUiState[] = ["ok", "silent", "unverified", "off"];

describe("computeFirstRun", () => {
  for (const uiState of UI) {
    for (const hasActiveTrip of [false, true]) {
      for (const hasAnyExpense of [false, true]) {
        it(`ui=${uiState} trip=${hasActiveTrip} expense=${hasAnyExpense}`, () => {
          const r = computeFirstRun({ uiState, hasActiveTrip, hasAnyExpense });
          expect(r.steps).toHaveLength(3);
          expect(r.steps[0]).toEqual({
            id: "connect",
            done: uiState === "ok" || uiState === "silent",
          });
          expect(r.steps[1]).toEqual({ id: "trip", done: hasActiveTrip });
          expect(r.steps[2]).toEqual({ id: "expense", done: hasAnyExpense });
          expect(r.doneCount).toBe(
            r.steps.filter((s) => s.done).length
          );
          expect(r.allDone).toBe(r.doneCount === 3);
        });
      }
    }
  }
});

describe("tripsHaveAnyExpense", () => {
  it("detects expenses or spent", () => {
    expect(tripsHaveAnyExpense([{ expenses: [], spent: 0 }])).toBe(false);
    expect(
      tripsHaveAnyExpense([{ expenses: [{ id: "1" }], spent: 0 }])
    ).toBe(true);
    expect(tripsHaveAnyExpense([{ expenses: [], spent: 100 }])).toBe(true);
  });
});
