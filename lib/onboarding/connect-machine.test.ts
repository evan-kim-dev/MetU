import { describe, expect, it } from "vitest";

import {
  canFinish,
  canFinishAnyway,
  connectReducer,
  initialConnectState,
  stepTotal,
  type ConnectAction,
  type ConnectState,
} from "@/lib/onboarding/connect-machine";

const TOKEN = "metu-AAAA-BBBB-CCCC-DDDD";

function apply(state: ConnectState, ...actions: ConnectAction[]) {
  return actions.reduce(connectReducer, state);
}

describe("connectReducer", () => {
  it("iOS path device→code→shortcut→automation→verify→done", () => {
    let s = initialConnectState();
    s = apply(s, { type: "PLATFORM_DETECTED", platform: "ios" });
    expect(s.phase).toBe("device");
    s = apply(s, { type: "SET_IOS27", value: true });
    expect(s.phase).toBe("code");
    s = apply(s, { type: "ISSUE_START" }, { type: "ISSUE_OK", token: TOKEN });
    expect(s.phase).toBe("code");
    expect(s.token.plain).toBe(TOKEN);
    s = apply(s, { type: "CODE_NEXT" });
    expect(s.phase).toBe("shortcut");
    s = apply(s, { type: "CONFIRM_ADDED" });
    expect(s.phase).toBe("automation");
    s = apply(s, { type: "CONFIRM_AUTOMATION" });
    expect(s.phase).toBe("verify");
    s = apply(
      s,
      { type: "SERVER_TEST_START" },
      { type: "SERVER_TEST_OK" },
      { type: "EVENT_RECEIVED", kind: "real", at: "2026-10-31T00:00:00Z" },
      { type: "FINISH_START" },
      { type: "FINISH_OK", status: "done" }
    );
    expect(s.phase).toBe("done");
    expect(stepTotal(s)).toBe(5);
  });

  it("Android skips shortcut", () => {
    let s = initialConnectState();
    s = apply(
      s,
      { type: "PLATFORM_DETECTED", platform: "android" },
      { type: "PLATFORM_DETECTED", platform: "android" }
    );
    expect(s.phase).toBe("code");
    s = apply(
      s,
      { type: "ISSUE_START" },
      { type: "ISSUE_OK", token: TOKEN },
      { type: "CODE_NEXT" }
    );
    expect(s.phase).toBe("automation");
    expect(stepTotal(s)).toBe(4);
  });

  it("desktop → unsupported", () => {
    const s = apply(initialConnectState(), {
      type: "PLATFORM_DETECTED",
      platform: "desktop",
    });
    expect(s.phase).toBe("unsupported");
  });

  it("ios <27 → unsupported", () => {
    let s = apply(initialConnectState(), {
      type: "PLATFORM_DETECTED",
      platform: "ios",
    });
    s = apply(s, { type: "SET_IOS27", value: false });
    expect(s.phase).toBe("unsupported");
  });

  it("SKIP from anywhere", () => {
    const s = apply(
      initialConnectState(),
      { type: "PLATFORM_DETECTED", platform: "ios" },
      { type: "SET_IOS27", value: true },
      { type: "SKIP_START" },
      { type: "SKIP_OK" }
    );
    expect(s.phase).toBe("skipped");
  });

  it("REISSUE_REQUEST / CANCEL", () => {
    let s = apply(
      initialConnectState(),
      { type: "PLATFORM_DETECTED", platform: "ios" },
      { type: "SET_IOS27", value: true },
      { type: "ISSUE_START" },
      { type: "ISSUE_OK", token: TOKEN },
      { type: "REISSUE_REQUEST" }
    );
    expect(s.reissueOpen).toBe(true);
    s = apply(s, { type: "REISSUE_CANCEL" });
    expect(s.reissueOpen).toBe(false);
  });

  it("FINISH requires serverOk && deviceOk; FINISH_ANYWAY via partial", () => {
    let s = apply(
      initialConnectState(),
      { type: "PLATFORM_DETECTED", platform: "ios" },
      { type: "SET_IOS27", value: true },
      { type: "ISSUE_START" },
      { type: "ISSUE_OK", token: TOKEN },
      { type: "CODE_NEXT" },
      { type: "CONFIRM_ADDED" },
      { type: "CONFIRM_AUTOMATION" },
      { type: "SERVER_TEST_START" },
      { type: "SERVER_TEST_OK" }
    );
    expect(canFinish(s)).toBe(false);
    expect(canFinishAnyway(s)).toBe(true);
    const blocked = connectReducer(s, { type: "FINISH_START" });
    // FINISH_START with only serverOk sets finishStatus partial
    expect(blocked.busy).toBe("finish");
    expect(blocked.finishStatus).toBe("partial");
    s = apply(
      s,
      { type: "EVENT_RECEIVED", kind: "real", at: "t" },
      { type: "FINISH_START" },
      { type: "FINISH_OK", status: "done" }
    );
    expect(s.phase).toBe("done");
  });

  it("invalid transition returns same reference", () => {
    const s = initialConnectState();
    const next = connectReducer(s, { type: "CONFIRM_ADDED" });
    expect(next).toBe(s);
  });

  it("CONFIRM_AUTOMATION with empty apps allowed", () => {
    let s = apply(
      initialConnectState(),
      { type: "PLATFORM_DETECTED", platform: "android" },
      { type: "PLATFORM_DETECTED", platform: "android" },
      { type: "ISSUE_START" },
      { type: "ISSUE_OK", token: TOKEN },
      { type: "CODE_NEXT" }
    );
    expect(s.selectedApps).toEqual([]);
    s = apply(s, { type: "CONFIRM_AUTOMATION" });
    expect(s.phase).toBe("verify");
  });
});
