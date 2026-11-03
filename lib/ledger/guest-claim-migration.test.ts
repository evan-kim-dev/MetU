import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 20261103220000_guest_claim_trigger.sql 정적 점검.
 * 실제 동작은 supabase/verify/guest_permissions_verify.sql 블록 B(T19·T20)로 DB 에서 확인해요.
 */
const dir = join(process.cwd(), "supabase", "migrations");
const file = "20261103220000_guest_claim_trigger.sql";

const code = readFileSync(join(dir, file), "utf8")
  .replace(/\r\n/g, "\n")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("guest claim trigger migration", () => {
  it("S0 이후에 적용되는 새 파일이에요", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    expect(files.indexOf(file)).toBeGreaterThan(
      files.indexOf("20261103140000_guest_permissions.sql")
    );
  });

  it("트리거 함수만 교체하고 security invoker 를 유지해요", () => {
    expect(code).toMatch(
      /create or replace function public\.trip_members_guest_guard\(\)/
    );
    expect(code).toMatch(/security invoker/);
    expect(code).not.toMatch(/security definer/);
    expect(code).not.toMatch(/drop trigger|create trigger/);
  });

  it("익명은 trip_id·role·is_owner 를 바꿀 수 없어요", () => {
    expect(code).toMatch(/new\.trip_id is distinct from old\.trip_id/);
    expect(code).toMatch(/new\.role is distinct from old\.role/);
    expect(code).toMatch(/new\.is_owner is distinct from old\.is_owner/);
  });

  it("user_id 는 빈 자리 → 본인 전환만 허용해요", () => {
    expect(code).toMatch(
      /not \(old\.user_id is null and new\.user_id = \(select auth\.uid\(\)\)\)/
    );
    expect(code).toMatch(/guest-cannot-change-membership/);
    expect(code).toMatch(/errcode = '42501'/);
  });
});
