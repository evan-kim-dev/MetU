import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeCodefCard, parseBenefitText } from "./benefits";
import { generateKeyPairSync } from "node:crypto";
import {
  createCardConnectedId,
  decodeCodefBody,
  encryptCodefPassword,
  fetchCardResultCheck,
  resetCodefTokenCacheForTests,
} from "./codef-client";
import { toCardList } from "./codef-schema";
import { DEMO_CODEF_DATA } from "./mock";
import { planCardSpend } from "./plan";
import type { CardSnapshot } from "./types";

describe("parseBenefitText", () => {
  it("퍼센트·월 한도(만원)·해외 범위를 읽어요", () => {
    const b = parseBenefitText({
      type: "청구할인",
      name: "[해외결제]해외 가맹점 2% 청구할인",
      details: [{ conditions: "전월 실적 30만원 이상, 월 최대 2만원" }],
    });
    expect(b.rate).toBeCloseTo(0.02);
    expect(b.monthlyCapKrw).toBe(20_000);
    expect(b.scopes).toContain("overseas");
    expect(b.kind).toBe("discount");
    expect(b.status).toBe("parsed");
  });

  it("월 한도 숫자(콤마)와 교통 범위를 읽어요", () => {
    const b = parseBenefitText({ name: "[교통]대중교통 10% 청구할인", details: [{ conditions: "월 최대 5,000원" }] });
    expect(b.rate).toBeCloseTo(0.1);
    expect(b.monthlyCapKrw).toBe(5_000);
    expect(b.scopes).toEqual(["transport"]);
  });

  it("건당 정액 할인을 읽고 퍼센트는 비워요", () => {
    const b = parseBenefitText({ name: "[음료할인]커피전문점 3,000원 할인" });
    expect(b.rate).toBeNull();
    expect(b.flatKrw).toBe(3_000);
    expect(b.scopes).toContain("food");
  });

  it("금액·범위를 못 읽으면 needs-review", () => {
    const b = parseBenefitText({ type: "적립", name: "[기타]제휴처 포인트 적립" });
    expect(b.kind).toBe("reward");
    expect(b.status).toBe("needs-review");
  });
});

describe("normalizeCodefCard", () => {
  it("카드번호는 끝 4자리만 남기고 실적을 숫자로 바꿔요", () => {
    const cards = toCardList(DEMO_CODEF_DATA).map((c, i) => normalizeCodefCard(c, i));
    expect(cards).toHaveLength(3);
    expect(cards[1]!.last4).toBe("2222");
    expect(JSON.stringify(cards)).not.toContain("4512345678902222");
    expect(cards[1]!.performance).toMatchObject({
      currentKrw: 180_000,
      requiredKrw: 120_000,
      standardKrw: 300_000,
      met: false,
    });
  });

  it("단건 객체 응답도 배열로 받아요", () => {
    expect(toCardList(DEMO_CODEF_DATA[0])).toHaveLength(1);
    expect(toCardList(null)).toEqual([]);
  });
});

describe("planCardSpend", () => {
  const cards: CardSnapshot[] = toCardList(DEMO_CODEF_DATA).map((c, i) => normalizeCodefCard(c, i));

  it("분류마다 할인이 가장 큰 카드를 고르고 월 한도를 지켜요", () => {
    const plan = planCardSpend(cards, {
      flight: 350_000,
      lodging: 300_000,
      food: 200_000,
      transport: 60_000,
      shopping: 90_000,
    });
    const by = Object.fromEntries(plan.categories.map((p) => [p.category, p]));
    // 항공 5% = 17,500 (한도 3만 이내) — 실적 부족 카드라 조건부
    expect(by.flight).toMatchObject({ cardId: cards[1]!.id, discountKrw: 17_500, conditional: true });
    // 숙박 7% = 21,000 → 월 한도 2만원
    expect(by.lodging).toMatchObject({ cardId: cards[1]!.id, discountKrw: 20_000, conditional: true });
    // 식비: 음식점 10% = 20,000 → 한도 1만원 vs 해외 2% = 4,000 vs 커피 정액 3,000 → 1만원(조건부)
    expect(by.food!.discountKrw).toBe(10_000);
    // 교통: 10% = 6,000 → 한도 5,000 vs 해외 2% = 1,200 → 5,000 (실적 충족 카드)
    expect(by.transport).toMatchObject({ cardId: cards[0]!.id, discountKrw: 5_000, conditional: false });
    // 쇼핑: 해외 2% = 1,800
    expect(by.shopping).toMatchObject({ cardId: cards[0]!.id, discountKrw: 1_800 });
    expect(plan.confirmedDiscountKrw + plan.conditionalDiscountKrw).toBe(
      plan.categories.reduce((s, p) => s + p.discountKrw, 0)
    );
  });

  it("한 혜택의 월 한도를 두 분류가 나눠 써요", () => {
    const one: CardSnapshot[] = [
      {
        id: "a",
        name: "A",
        company: null,
        last4: null,
        performance: { currentKrw: 1, requiredKrw: 0, standardKrw: 1, met: true, periodStart: null, periodEnd: null },
        benefits: [
          parseBenefitText({ name: "해외 가맹점 5% 할인, 월 최대 10,000원" }),
        ],
      },
    ];
    const plan = planCardSpend(one, { food: 150_000, shopping: 150_000 });
    const total = plan.categories.reduce((s, p) => s + p.discountKrw, 0);
    expect(total).toBe(10_000);
  });

  it("실적 부족분을 이번 여행 결제로 채우는지 알려줘요", () => {
    const plan = planCardSpend(cards, { flight: 350_000 });
    const life = plan.cards.find((c) => c.cardId === cards[1]!.id)!;
    expect(life).toMatchObject({ shortfallKrw: 120_000, assignedSpendKrw: 350_000, fillsShortfall: true });
  });

  it("예산이 0이면 할인도 0", () => {
    const plan = planCardSpend(cards, {});
    expect(plan.confirmedDiscountKrw).toBe(0);
    expect(plan.conditionalDiscountKrw).toBe(0);
  });
});

describe("codef-client", () => {
  it("URL 인코딩된 응답과 평문 JSON 둘 다 읽어요", () => {
    const obj = { result: { code: "CF-00000" }, data: { resCardName: "카드" } };
    expect(decodeCodefBody(JSON.stringify(obj))).toEqual(obj);
    expect(decodeCodefBody(encodeURIComponent(JSON.stringify(obj)))).toEqual(obj);
  });

  it("토큰 발급 후 실적조회를 호출하고 실패 코드를 그대로 돌려줘요", async () => {
    resetCodefTokenCacheForTests();
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      if (String(url).includes("oauth")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
      }
      return new Response(
        encodeURIComponent(JSON.stringify({ result: { code: "CF-03002", message: "추가인증" }, data: {} }))
      );
    }) as unknown as typeof fetch;
    const out = await fetchCardResultCheck(
      { clientId: "id", clientSecret: "secret", host: "https://development.codef.io" },
      { organization: "0309", connectedId: "abc" },
      fetchImpl
    );
    expect(calls[0]).toContain("oauth.codef.io");
    expect(calls[1]).toContain("/v1/kr/card/p/account/result-check-list");
    expect(out).toEqual({ ok: false, code: "CF-03002", message: "추가인증" });
  });

  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKeyB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  it("비밀번호를 RSA 공개키로 암호화해요 (평문이 남지 않음)", () => {
    const a = encryptCodefPassword(publicKeyB64, "pw-1234");
    const b = encryptCodefPassword(publicKeyB64, "pw-1234");
    expect(Buffer.from(a, "base64")).toHaveLength(256);
    expect(a).not.toContain("pw-1234");
    expect(a).not.toBe(b); // PKCS#1 v1.5 랜덤 패딩
  });

  it("계정등록: 카드(CD)·아이디 로그인으로 보내고 connectedId 를 돌려줘요", async () => {
    resetCodefTokenCacheForTests();
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("oauth")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
      }
      bodies.push(String(init?.body ?? ""));
      return new Response(
        encodeURIComponent(
          JSON.stringify({
            result: { code: "CF-00000", message: "성공" },
            data: { connectedId: "cid-1", successList: [{}], errorList: [] },
          })
        )
      );
    }) as unknown as typeof fetch;
    const out = await createCardConnectedId(
      { clientId: "id", clientSecret: "secret", host: "https://development.codef.io", publicKey: publicKeyB64 },
      { organization: "0309", loginId: "me", password: "pw-1234" },
      fetchImpl
    );
    expect(out).toEqual({ ok: true, connectedId: "cid-1" });
    const sent = JSON.parse(decodeURIComponent(bodies[0]!)) as {
      accountList: Array<Record<string, string>>;
    };
    expect(sent.accountList[0]).toMatchObject({
      countryCode: "KR",
      businessType: "CD",
      clientType: "P",
      organization: "0309",
      loginType: "1",
      id: "me",
    });
    expect(sent.accountList[0]!.password).not.toBe("pw-1234");
    expect(bodies[0]).not.toContain("pw-1234");
  });

  it("계정등록: errorList 가 있으면 그 코드·메시지로 실패해요", async () => {
    resetCodefTokenCacheForTests();
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("oauth")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
      }
      return new Response(
        JSON.stringify({
          result: { code: "CF-04012", message: "실패" },
          data: { errorList: [{ code: "CF-12100", message: "아이디 또는 비밀번호 오류" }] },
        })
      );
    }) as unknown as typeof fetch;
    const out = await createCardConnectedId(
      { clientId: "id", clientSecret: "secret", host: "https://development.codef.io", publicKey: publicKeyB64 },
      { organization: "0309", loginId: "me", password: "x" },
      fetchImpl
    );
    expect(out).toEqual({ ok: false, code: "CF-12100", message: "아이디 또는 비밀번호 오류" });
  });

  it("계정등록: 공개키가 없으면 호출하지 않아요", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const out = await createCardConnectedId(
      { clientId: "id", clientSecret: "secret", host: "https://development.codef.io" },
      { organization: "0309", loginId: "me", password: "x" },
      fetchImpl
    );
    expect(out).toMatchObject({ ok: false, code: "no-public-key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
