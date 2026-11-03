import { describe, expect, it } from "vitest";
import { shareTargetLoginNext } from "@/lib/ledger/share-target-next";

describe("shareTargetLoginNext", () => {
  it("id 를 next 에 유지해요", () => {
    expect(shareTargetLoginNext("?id=abc_12")).toBe("/share-target?id=abc_12");
  });

  it("text 를 next 에 유지해요", () => {
    expect(shareTargetLoginNext("?text=%EC%8A%B9%EC%9D%B812000")).toBe(
      `/share-target?text=${encodeURIComponent("승인12000")}`
    );
  });

  it("쿼리 없으면 /share-target 이에요", () => {
    expect(shareTargetLoginNext("")).toBe("/share-target");
  });

  it("이상한 id 는 버리고 /share-target 이에요", () => {
    expect(shareTargetLoginNext("?id=../evil")).toBe("/share-target");
  });
});
