import { describe, expect, it } from "vitest";

import {
  canFinish,
  canFinishAnyway,
  connectReducer,
  connectStepCards,
  initialConnectState,
  pickVerifyArrival,
  stepTotal,
  type ConnectAction,
  type ConnectState,
} from "@/lib/onboarding/connect-machine";

const TOKEN = "metu-AAAA-BBBB-CCCC-DDDD";
const STARTED = "2026-10-31T00:00:00.000Z";
const BEFORE = "2026-10-30T23:59:59.000Z";
const AFTER = "2026-10-31T00:00:05.000Z";

function toVerify(platform: "ios" | "android" = "ios"): ConnectState {
  const detect: ConnectAction[] =
    platform === "ios"
      ? [
          { type: "PLATFORM_DETECTED", platform: "ios" },
          { type: "SET_IOS27", value: true },
        ]
      : [
          { type: "PLATFORM_DETECTED", platform: "android" },
          { type: "PLATFORM_DETECTED", platform: "android" },
        ];
  return apply(
    initialConnectState(),
    ...detect,
    { type: "ISSUE_START" },
    { type: "ISSUE_OK", token: TOKEN },
    { type: "CODE_NEXT" },
    ...(platform === "ios" ? ([{ type: "CONFIRM_ADDED" }] as ConnectAction[]) : []),
    { type: "CONFIRM_AUTOMATION", at: STARTED }
  );
}

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
    s = apply(s, { type: "CONFIRM_AUTOMATION", at: STARTED });
    expect(s.phase).toBe("verify");
    expect(s.verifyStartedAt).toBe(STARTED);
    s = apply(
      s,
      { type: "EVENT_RECEIVED", kind: "real", at: AFTER },
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

  it("FINISH(done) requires an arrived notification; otherwise partial", () => {
    let s = toVerify();
    // 서버 테스트만 통과해도 연결됨이 아니에요.
    s = apply(s, { type: "SERVER_TEST_START" }, { type: "SERVER_TEST_OK" });
    expect(s.serverOk).toBe(true);
    expect(s.deviceOk).toBe(false);
    expect(canFinish(s)).toBe(false);
    expect(canFinishAnyway(s)).toBe(true);
    const partial = connectReducer(s, { type: "FINISH_START" });
    expect(partial.busy).toBe("finish");
    expect(partial.finishStatus).toBe("partial");
    s = apply(
      s,
      { type: "EVENT_RECEIVED", kind: "real", at: AFTER },
      { type: "FINISH_START" },
      { type: "FINISH_OK", status: "done" }
    );
    expect(s.phase).toBe("done");
  });

  describe("verify: 진짜 연결 테스트", () => {
    it("verifyStartedAt 이전 타임스탬프는 deviceOk 를 만들지 않아요", () => {
      const s = toVerify();
      const next = connectReducer(s, {
        type: "EVENT_RECEIVED",
        kind: "real",
        at: BEFORE,
      });
      expect(next).toBe(s);
      expect(next.deviceOk).toBe(false);
      // 같은 시각도 "이후"가 아니에요.
      expect(
        connectReducer(s, { type: "EVENT_RECEIVED", kind: "real", at: STARTED })
          .deviceOk
      ).toBe(false);
    });

    it("이후 이벤트는 deviceOk 를 만들어요 (테스트: 연결 OK, 실제: 자동 기록 OK)", () => {
      let s = toVerify();
      s = connectReducer(s, {
        type: "EVENT_RECEIVED",
        kind: "device-test",
        at: AFTER,
      });
      expect(s.deviceOk).toBe(true);
      expect(s.realOk).toBe(false);
      s = connectReducer(s, {
        type: "EVENT_RECEIVED",
        kind: "real",
        at: "2026-10-31T00:01:00.000Z",
      });
      expect(s.deviceOk).toBe(true);
      expect(s.realOk).toBe(true);
      expect(s.firstEventAt).toBe(AFTER);
    });

    it("sim(서버 테스트) 이벤트는 무시해요", () => {
      const s = toVerify();
      const next = connectReducer(s, {
        type: "EVENT_RECEIVED",
        kind: "real",
        at: AFTER,
        source: "sim",
      });
      expect(next).toBe(s);
    });

    it("기준 시각이 없으면 어떤 이벤트도 인정하지 않아요", () => {
      const s = apply(toVerify(), {
        type: "GO_TO_STEP",
        phase: "automation",
      });
      expect(s.phase).toBe("automation");
      const manual: ConnectState = {
        ...toVerify(),
        verifyStartedAt: undefined,
      };
      expect(
        connectReducer(manual, {
          type: "EVENT_RECEIVED",
          kind: "real",
          at: AFTER,
        }).deviceOk
      ).toBe(false);
    });

    it("허브에서 다시 확인해도 이전 성공은 인정하지 않고 새로 기다려요", () => {
      const s = apply(
        initialConnectState(),
        { type: "ENTER_HUB", platform: "ios" },
        { type: "RESUME_VERIFY", at: STARTED }
      );
      expect(s.verifyStartedAt).toBe(STARTED);
      expect(s.deviceOk).toBe(false);
      expect(
        connectReducer(s, { type: "EVENT_RECEIVED", kind: "real", at: BEFORE })
          .deviceOk
      ).toBe(false);
    });

    it("확인 단계에 다시 들어오면 기다림을 처음부터 시작해요", () => {
      let s = toVerify();
      s = connectReducer(s, {
        type: "EVENT_RECEIVED",
        kind: "real",
        at: AFTER,
      });
      s = apply(s, { type: "GO_TO_STEP", phase: "automation" });
      s = apply(s, {
        type: "CONFIRM_AUTOMATION",
        at: "2026-10-31T01:00:00.000Z",
      });
      expect(s.deviceOk).toBe(false);
      expect(s.realOk).toBe(false);
      expect(s.verifyStartedAt).toBe("2026-10-31T01:00:00.000Z");
    });

    it("pickVerifyArrival: 이전 타임스탬프는 null, 이후는 실제 알림 우선", () => {
      expect(
        pickVerifyArrival(STARTED, {
          lastRealEventAt: BEFORE,
          lastDeviceTestAt: BEFORE,
        })
      ).toBeNull();
      expect(pickVerifyArrival(undefined, { lastRealEventAt: AFTER })).toBeNull();
      expect(
        pickVerifyArrival(STARTED, {
          lastRealEventAt: null,
          lastDeviceTestAt: AFTER,
        })
      ).toEqual({ kind: "device-test", at: AFTER });
      expect(
        pickVerifyArrival(STARTED, {
          lastRealEventAt: "2026-10-31T00:02:00.000Z",
          lastDeviceTestAt: AFTER,
        })
      ).toEqual({ kind: "real", at: "2026-10-31T00:02:00.000Z" });
    });
  });

  describe("단계 카드", () => {
    it("iOS 는 5개, 현재 단계 강조·완료 단계 표시", () => {
      const s = apply(
        initialConnectState(),
        { type: "PLATFORM_DETECTED", platform: "ios" },
        { type: "SET_IOS27", value: true },
        { type: "ISSUE_START" },
        { type: "ISSUE_OK", token: TOKEN },
        { type: "CODE_NEXT" }
      );
      const cards = connectStepCards(s);
      expect(cards.map((c) => c.phase)).toEqual([
        "device",
        "code",
        "shortcut",
        "automation",
        "verify",
      ]);
      expect(cards.map((c) => c.status)).toEqual([
        "done",
        "done",
        "current",
        "upcoming",
        "upcoming",
      ]);
    });

    it("Android 는 매크로 단계가 하나라 4개", () => {
      expect(connectStepCards(toVerify("android"))).toHaveLength(4);
    });

    it("완료한 단계로만 되돌아갈 수 있어요", () => {
      const s = toVerify();
      expect(
        connectReducer(s, { type: "GO_TO_STEP", phase: "verify" })
      ).toBe(s);
      const back = connectReducer(s, { type: "GO_TO_STEP", phase: "code" });
      expect(back.phase).toBe("code");
      expect(back.token.plain).toBe(TOKEN);
      const device = connectReducer(s, { type: "GO_TO_STEP", phase: "device" });
      expect(device.phase).toBe("device");
      const early = apply(
        initialConnectState(),
        { type: "PLATFORM_DETECTED", platform: "ios" },
        { type: "SET_IOS27", value: true }
      );
      expect(
        connectReducer(early, { type: "GO_TO_STEP", phase: "automation" })
      ).toBe(early);
    });
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
    s = apply(s, { type: "CONFIRM_AUTOMATION", at: STARTED });
    expect(s.phase).toBe("verify");
  });

  it("ENTER_HUB → START_ADD_DEVICE → code with issueMode add", () => {
    let s = apply(initialConnectState(), {
      type: "ENTER_HUB",
      platform: "ios",
    });
    expect(s.phase).toBe("hub");
    s = apply(s, { type: "START_ADD_DEVICE" });
    expect(s.phase).toBe("code");
    expect(s.issueMode).toBe("add");
    expect(s.token.plain).toBeUndefined();
    expect(s.reissueOpen).toBe(false);
  });

  it("ENTER_HUB → START_REISSUE opens reissue dialog on code", () => {
    let s = apply(initialConnectState(), {
      type: "ENTER_HUB",
      platform: "android",
    });
    s = apply(s, { type: "START_REISSUE" });
    expect(s.phase).toBe("code");
    expect(s.issueMode).toBe("reissue");
    expect(s.needsToken).toBe(true);
    expect(s.reissueOpen).toBe(true);
  });

  it("ENTER_HUB → RESUME_VERIFY", () => {
    const s = apply(
      initialConnectState(),
      { type: "ENTER_HUB", platform: "ios" },
      { type: "RESUME_VERIFY" }
    );
    expect(s.phase).toBe("verify");
    expect(s.serverOk).toBe(false);
    expect(s.deviceOk).toBe(false);
  });

  it("BACK_TO_HUB only from hub-originated flows", () => {
    const wizard = apply(
      initialConnectState(),
      { type: "PLATFORM_DETECTED", platform: "ios" },
      { type: "SET_IOS27", value: true }
    );
    expect(wizard.issueMode).toBe("wizard");
    expect(connectReducer(wizard, { type: "BACK_TO_HUB" })).toBe(wizard);

    let hub = apply(initialConnectState(), {
      type: "ENTER_HUB",
      platform: "ios",
    });
    hub = apply(hub, { type: "START_ADD_DEVICE" });
    hub = apply(hub, { type: "BACK_TO_HUB" });
    expect(hub.phase).toBe("hub");
    expect(hub.issueMode).toBe("wizard");
  });

  it("hub actions ignored outside hub", () => {
    const s = initialConnectState();
    expect(connectReducer(s, { type: "START_ADD_DEVICE" })).toBe(s);
    expect(connectReducer(s, { type: "RESUME_VERIFY" })).toBe(s);
  });
});
