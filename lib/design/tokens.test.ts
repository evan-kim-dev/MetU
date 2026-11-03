import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MU_COLORS,
  MU_CSS_VARS,
  contrastRatio,
  relativeLuminance,
} from "./tokens";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

describe("WCAG contrast (mu tokens)", () => {
  it("computes known relative luminance for white/black", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("fg / fg2 / fg3 on card · bg · sunken ≥ 4.5", () => {
    for (const fg of [MU_COLORS.fg, MU_COLORS.fg2, MU_COLORS.fg3] as const) {
      for (const bg of [
        MU_COLORS.card,
        MU_COLORS.bg,
        MU_COLORS.sunken,
      ] as const) {
        expect(
          contrastRatio(fg, bg),
          `${fg} on ${bg}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("accent on card · accentSoft ≥ 4.5", () => {
    expect(contrastRatio(MU_COLORS.accent, MU_COLORS.card)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(
      contrastRatio(MU_COLORS.accent, MU_COLORS.accentSoft)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("onAccent on accent · accentStrong ≥ 4.5", () => {
    expect(
      contrastRatio(MU_COLORS.onAccent, MU_COLORS.accent)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(MU_COLORS.onAccent, MU_COLORS.accentStrong)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("status pairs ≥ 4.5", () => {
    expect(contrastRatio(MU_COLORS.ok, MU_COLORS.okSoft)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(
      contrastRatio(MU_COLORS.warn, MU_COLORS.warnSoft)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(MU_COLORS.err, MU_COLORS.errSoft)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("lineStrong on card ≥ 3 (UI boundary)", () => {
    expect(
      contrastRatio(MU_COLORS.lineStrong, MU_COLORS.card)
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("globals.css sync", () => {
  it("every MU_CSS_VARS value appears in globals.css :root", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
    for (const [name, value] of Object.entries(MU_CSS_VARS)) {
      expect(css, name).toContain(name);
      // durations / ease may differ in casing of hex — normalize hex compare
      if (value.startsWith("#")) {
        expect(css.toLowerCase()).toContain(value.toLowerCase());
      } else {
        // allow whitespace variants for cubic-bezier
        const compact = value.replace(/\s+/g, "");
        expect(css.replace(/\s+/g, "")).toContain(compact);
      }
    }
  });
});

describe("ds forbidden style scan", () => {
  const HEX = /#[0-9a-fA-F]{3,8}\b/;
  const BRACKET_HEX = /\[#/;
  const TW_PALETTE =
    /(bg|text|border|ring|fill|stroke)-(red|blue|green|gray|slate|zinc|amber|yellow|orange|indigo|purple|pink|emerald|sky)-\d/;
  const FORBIDDEN = [/shadow-glow/, /ai-gradient/, /text-\[10px\]/];

  /** kakao brand tokens are allowed as exception. */
  function stripAllowed(src: string): string {
    return src
      .replace(/kakao-[a-z]+/gi, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  it("components/ds has no arbitrary hex / palette / glow / 10px", () => {
    const root = join(process.cwd(), "components", "ds");
    const files = walk(root);
    expect(files.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const file of files) {
      if (file.endsWith(".test.tsx") || file.endsWith(".test.ts")) continue;
      const raw = stripAllowed(readFileSync(file, "utf8"));
      if (HEX.test(raw) || BRACKET_HEX.test(raw) || TW_PALETTE.test(raw)) {
        hits.push(file);
      }
      for (const re of FORBIDDEN) {
        if (re.test(raw)) hits.push(`${file}:${re}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
