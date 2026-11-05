import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261106010000_host_payout_profile.sql"
  ),
  "utf8"
).replace(/\r\n/g, "\n");

const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("host_payout_profile migration", () => {
  it("ledger_payout_profiles 는 본인만 RLS 로 접근해요", () => {
    expect(code).toMatch(/create table if not exists public\.ledger_payout_profiles/);
    expect(code).toMatch(/ledger_payout_profiles_own/);
    expect(code).toMatch(/user_id = auth\.uid\(\)/);
  });

  it("공유 RPC 가 hostPayout 을 반환하고 anon 실행을 허용해요", () => {
    expect(code).toMatch(
      /create or replace function public\.get_shared_settlement_detail\(p_token text\)/
    );
    expect(code).toMatch(/'hostPayout', v_payout/);
    expect(code).toMatch(
      /grant execute on function public\.get_shared_settlement_detail\(text\) to anon, authenticated/
    );
  });

  it("RPC 반환에 email·user_id·receipt 경로를 넣지 않아요", () => {
    const fn = code.slice(code.indexOf("return jsonb_build_object("));
    for (const forbidden of [
      "receipt_path",
      "raw_input",
      "email",
      "card_label",
      "share_token",
    ]) {
      expect(fn, forbidden).not.toContain(forbidden);
    }
  });
});
