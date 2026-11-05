import { describe, expect, it, vi } from "vitest";
import { buildTossSendUrl, executeTossTransfer } from "@/lib/ledger/toss";

describe("buildTossSendUrl", () => {
  it("은행·계좌·금액을 send 스킴에 실어요", () => {
    const url = buildTossSendUrl({
      bank: "국민은행",
      accountNo: "943202-00-709112",
      amount: 12345.6,
    });
    expect(url).toBe(
      `supertoss://send?bank=${encodeURIComponent("국민은행")}&accountNo=94320200709112&amount=12346`
    );
  });
});

describe("executeTossTransfer", () => {
  it("모바일이면 앱 스킴을 열고 copy 콜백은 안 불러요", async () => {
    const navigate = vi.fn();
    const onSuccessCopy = vi.fn();
    const res = await executeTossTransfer({
      bank: "국민은행",
      accountNo: "943202-00-709112",
      amount: 5000,
      navigate,
      onSuccessCopy,
      isMobile: true,
    });
    expect(res.mode).toBe("app");
    expect(navigate).toHaveBeenCalledOnce();
    expect(String(navigate.mock.calls[0]?.[0])).toMatch(/^supertoss:\/\/send\?/);
    expect(onSuccessCopy).not.toHaveBeenCalled();
  });

  it("PC면 클립보드에 복사하고 onSuccessCopy 를 불러요", async () => {
    const writeText = vi.fn(async () => undefined);
    const onSuccessCopy = vi.fn();
    const navigate = vi.fn();
    const res = await executeTossTransfer({
      bank: "국민은행",
      accountNo: "943202-00-709112",
      amount: 5000,
      writeText,
      onSuccessCopy,
      navigate,
      isMobile: false,
    });
    expect(res.mode).toBe("copy");
    expect(navigate).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith("국민은행 94320200709112 5000원");
    expect(onSuccessCopy).toHaveBeenCalledOnce();
  });
});
