/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  TRAVEL_DRAFT_KEY,
  clearTravelDraft,
  emptyTravelDraft,
  loadTravelDraft,
  saveTravelDraft,
} from "@/lib/onboarding/travel-draft";
import { INITIAL_FORM } from "@/lib/onboarding/types";

afterEach(() => {
  sessionStorage.clear();
});

describe("travel-draft", () => {
  it("저장 후 같은 step·form 을 복원해요", () => {
    const draft = {
      step: 3,
      form: {
        ...INITIAL_FORM,
        budget: "50",
        destination: "오사카",
        styles: ["food" as const],
      },
    };
    saveTravelDraft(draft);
    expect(loadTravelDraft()).toEqual(draft);
  });

  it("깨진 JSON 은 null 이에요", () => {
    sessionStorage.setItem(TRAVEL_DRAFT_KEY, "{not-json");
    expect(loadTravelDraft()).toBeNull();
  });

  it("제출 후 clear 하면 비어요", () => {
    saveTravelDraft(emptyTravelDraft());
    clearTravelDraft();
    expect(loadTravelDraft()).toBeNull();
  });

  it("step 범위는 1~4 로 클램프해요", () => {
    saveTravelDraft({ step: 99, form: INITIAL_FORM });
    expect(loadTravelDraft()?.step).toBe(4);
  });
});
