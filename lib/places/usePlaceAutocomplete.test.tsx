// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPlaceAutocompleteCache,
  usePlaceAutocomplete,
} from "@/lib/places/usePlaceAutocomplete";

function HookProbe({
  query,
  mode = "cities" as const,
}: {
  query: string;
  mode?: "all" | "cities";
}) {
  const { items, loading, source } = usePlaceAutocomplete(query, mode);
  return (
    <div
      data-testid="probe"
      data-loading={loading ? "1" : "0"}
      data-source={source ?? ""}
      data-count={String(items.length)}
      data-first={items[0]?.name ?? ""}
    />
  );
}

function Controlled() {
  const [q, setQ] = useState("");
  return (
    <div>
      <button type="button" onClick={() => setQ("i")}>
        t1
      </button>
      <button type="button" onClick={() => setQ("ic")}>
        t2
      </button>
      <button type="button" onClick={() => setQ("icn")}>
        t3
      </button>
      <HookProbe query={q} />
    </div>
  );
}

afterEach(() => {
  cleanup();
  clearPlaceAutocompleteCache();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  clearPlaceAutocompleteCache();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

describe("usePlaceAutocomplete", () => {
  it("빈 입력은 fetch 0회 + 인기 도시", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<HookProbe query="" />);
    expect(fetchMock).not.toHaveBeenCalled();
    const probe = document.querySelector("[data-testid=probe]")!;
    expect(Number(probe.getAttribute("data-count"))).toBeGreaterThan(0);
    expect(probe.getAttribute("data-source")).toBe("local");
  });

  it("연속 입력 시 마지막 요청만 반영", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const u = String(url);
      const q = new URL(u, "http://localhost").searchParams.get("q") ?? "";
      return Promise.resolve(
        new Response(
          JSON.stringify({
            source: "remote",
            items: [
              {
                id: `city:${q}`,
                type: "city",
                code: q.toUpperCase(),
                name: q,
              },
            ],
          }),
          { status: 200 }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Controlled />);
    fireEvent.click(document.querySelectorAll("button")[0]!);
    fireEvent.click(document.querySelectorAll("button")[1]!);
    fireEvent.click(document.querySelectorAll("button")[2]!);

    await waitFor(
      () => {
        const probe = document.querySelector("[data-testid=probe]")!;
        expect(probe.getAttribute("data-first")).toBe("icn");
        expect(probe.getAttribute("data-loading")).toBe("0");
      },
      { timeout: 3000 }
    );

    const calledQs = fetchMock.mock.calls.map((c) => {
      const u = String(c[0]);
      return new URL(u, "http://localhost").searchParams.get("q");
    });
    expect(calledQs).toContain("icn");
    expect(calledQs.at(-1)).toBe("icn");
  });
});
