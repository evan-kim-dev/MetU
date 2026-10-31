import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 20261101140000_trip_member_read.sql 정적 점검.
 * 실제 RLS 동작은 DB 에서만 확인할 수 있으므로(파일 상단 주석의 수동 시나리오),
 * 여기서는 "정책이 의도한 모양인지"와 "공유 RPC 가 새는 필드가 없는지"만 고정한다.
 */
const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261101140000_trip_member_read.sql"
  ),
  "utf8"
).replace(/\r\n/g, "\n");

/** 주석(-- ...)을 뺀 실행 SQL. */
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("trip_member_read migration", () => {
  it("trips 멤버 select 정책만 추가한다 (update/delete 정책은 건드리지 않음)", () => {
    expect(code).toMatch(/drop policy if exists "trips_select_member" on public\.trips/);
    expect(code).toMatch(
      /create policy "trips_select_member"\s+on public\.trips for select\s+to authenticated\s+using \(public\.is_trip_member\(id\)\)/
    );
    expect(code).not.toMatch(/on public\.trips for (update|delete|insert|all)/);
  });

  it("공유 정산 상세 RPC: 지출 최대 200건, 정산 시점까지, 취소 건 제외", () => {
    expect(code).toMatch(/create or replace function public\.get_shared_settlement_detail\(p_token text\)/);
    expect(code).toMatch(/limit 200/);
    expect(code).toMatch(/e\.created_at <= v_s\.created_at/);
    expect(code).toMatch(/e\.status <> 'voided' or e\.voided_at > v_s\.created_at/);
    expect(code).toMatch(/security definer/);
    expect(code).toMatch(/set search_path = public/);
  });

  it("RPC 가 개인정보·내부 필드를 반환하지 않는다", () => {
    // 토큰 조회(where share_token = ...)는 반환 값이 아니므로 반환부(return ...)만 본다.
    const fn = code.slice(code.indexOf("return jsonb_build_object("));
    for (const forbidden of [
      "receipt_path",
      "raw_input",
      "user_id",
      "created_by",
      "email",
      "card_label",
      "note",
      "memo",
      "share_token",
    ]) {
      expect(fn, forbidden).not.toContain(forbidden);
    }
    // 멤버는 id 와 표시 이름만
    expect(fn).toMatch(/'id', m\.id, 'displayName', m\.display_name/);
  });

  it("anon 과 authenticated 에만 실행 권한을 주고 public 은 회수한다", () => {
    expect(code).toMatch(
      /revoke all on function public\.get_shared_settlement_detail\(text\) from public/
    );
    expect(code).toMatch(
      /grant execute on function public\.get_shared_settlement_detail\(text\) to anon, authenticated/
    );
  });

  it("기존 get_shared_settlement 는 건드리지 않는다", () => {
    expect(code).not.toMatch(/function public\.get_shared_settlement\(/);
  });
});
