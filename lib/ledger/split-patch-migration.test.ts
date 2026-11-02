import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 20261103120000_split_patch_history.sql 정적 점검.
 * 실제 동작은 DB 에서만 확인할 수 있으므로 "의도한 모양인지"만 고정한다.
 */
const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261103120000_split_patch_history.sql"
  ),
  "utf8"
).replace(/\r\n/g, "\n");

const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("split_patch_history migration", () => {
  it("이력 테이블: RLS 켜고 읽기 정책만, 쓰기 정책 없음", () => {
    expect(code).toMatch(
      /create table if not exists public\.trip_expense_split_history/
    );
    expect(code).toMatch(
      /alter table public\.trip_expense_split_history enable row level security/
    );
    expect(code).toMatch(
      /create policy "trip_expense_split_history_select"\s+on public\.trip_expense_split_history for select\s+to authenticated\s+using \(public\.is_trip_member\(trip_id\)\)/
    );
    expect(code).not.toMatch(
      /on public\.trip_expense_split_history for (insert|update|delete|all)/
    );
    expect(code).toMatch(
      /grant select on table public\.trip_expense_split_history to authenticated/
    );
  });

  it("사용자 원문을 저장하는 컬럼이 없다", () => {
    const table = code.slice(
      code.indexOf("create table if not exists public.trip_expense_split_history"),
      code.indexOf(");", code.indexOf("create table if not exists public.trip_expense_split_history"))
    );
    for (const forbidden of ["raw", "text_input", "prompt", "message", "utterance", "note"]) {
      expect(table, forbidden).not.toContain(forbidden);
    }
  });

  it("같은 지출·같은 키는 한 번만 (멱등 유니크 인덱스)", () => {
    expect(code).toMatch(
      /create unique index if not exists trip_expense_split_history_idem_uidx\s+on public\.trip_expense_split_history \(expense_id, idempotency_key\)/
    );
  });

  it.each([
    ["agent_apply_split_patch", "uuid, uuid, jsonb, text, jsonb, jsonb, text, text"],
    ["agent_undo_split_patch", "uuid, uuid"],
  ])("%s: security definer + service_role 전용", (name, args) => {
    expect(code).toMatch(
      new RegExp(`create or replace function public\\.${name}\\(`)
    );
    const body = code.slice(code.indexOf(`public.${name}(`));
    expect(body).toMatch(/security definer\s+set search_path = public/);
    expect(code).toMatch(
      new RegExp(
        `revoke all on function public\\.${name}\\(${args}\\)\\s+from public, anon, authenticated`
      )
    );
    expect(code).toMatch(
      new RegExp(
        `grant execute on function public\\.${name}\\(${args}\\)\\s+to service_role`
      )
    );
    expect(code).not.toMatch(
      new RegExp(`grant execute on function public\\.${name}[^;]*to (anon|authenticated|public)`)
    );
  });

  it("p_actor 의 소속을 직접 검증한다 (적용·되돌리기 모두)", () => {
    expect(code.match(/raise exception 'forbidden'/g)?.length).toBe(2);
    expect(code.match(/m\.user_id = p_actor/g)?.length).toBe(2);
    expect(code).toMatch(/t\.user_id = p_actor/);
  });

  it("적용: expectedBefore 충돌, 합 검증, 멱등 처리", () => {
    expect(code).toMatch(/v_current <> p_expected_before/);
    expect(code).toMatch(/'reason', 'conflict'/);
    expect(code).toMatch(/raise exception 'shares-sum-mismatch'/);
    expect(code).toMatch(/v_sum <> v_row\.krw_amount/);
    expect(code).toMatch(
      /where expense_id = p_expense_id and idempotency_key = p_idempotency_key/
    );
    expect(code).toMatch(/'already', true/);
  });

  it("되돌리기: 이미 되돌렸으면 성공, 이후 변경은 conflict", () => {
    expect(code).toMatch(/if v_hist\.undone_at is not null then/);
    expect(code).toMatch(/v_current <> v_hist\.after_shares/);
    expect(code).toMatch(/set undone_at = now\(\), undone_by = p_actor/);
  });

  it("열린 정산은 stale 로 표시한다", () => {
    expect(code.match(/set status = 'stale'/g)?.length).toBe(2);
  });
});
