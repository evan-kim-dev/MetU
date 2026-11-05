import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { transferTripHost } from "@/lib/ledger/supabase";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function rpcClient(message: string | null) {
  const rpc = vi.fn(async () =>
    message
      ? { data: null, error: { message } }
      : { data: null, error: null }
  );
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("transferTripHost", () => {
  it("성공하면 ok", async () => {
    const { client, rpc } = rpcClient(null);
    await expect(
      transferTripHost(client, "trip-1", "m-new")
    ).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transfer_trip_host", {
      p_trip_id: "trip-1",
      p_new_owner_member_id: "m-new",
    });
  });

  it("guest-cannot-host 를 한국어로 돌려요", async () => {
    const { client } = rpcClient("guest-cannot-host");
    await expect(
      transferTripHost(client, "trip-1", "m-guest")
    ).resolves.toEqual({
      ok: false,
      error: "아직 가입하지 않은 동행에게는 넘길 수 없어요.",
    });
  });

  it("forbidden 을 한국어로 돌려요", async () => {
    const { client } = rpcClient("forbidden");
    await expect(
      transferTripHost(client, "trip-1", "m-new")
    ).resolves.toEqual({
      ok: false,
      error: "호스트만 넘길 수 있어요.",
    });
  });
});

describe("transfer_trip_host migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261106020000_transfer_trip_host.sql"
    ),
    "utf8"
  ).replace(/\r\n/g, "\n");

  const code = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("security definer + authenticated 만 execute", () => {
    expect(code).toMatch(/create or replace function public\.transfer_trip_host/);
    expect(code).toMatch(/security definer/);
    expect(code).toMatch(
      /grant execute on function public\.transfer_trip_host\(uuid, uuid\) to authenticated/
    );
    expect(code).toMatch(
      /revoke all on function public\.transfer_trip_host\(uuid, uuid\) from public/
    );
  });

  it("trips.user_id 와 멤버 role/is_owner 를 함께 바꿉니다", () => {
    expect(code).toMatch(/update public\.trips[\s\S]*user_id = v_new\.user_id/);
    expect(code).toMatch(/role = 'owner'/);
    expect(code).toMatch(/is_owner = true/);
    expect(code).toMatch(/guest-cannot-host/);
  });
});
