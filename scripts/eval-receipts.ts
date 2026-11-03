/**
 * 영수증 평가 스크립트 (K4).
 * --dry: labels 스키마만 검증. 이미지·API 키 불필요.
 * 기본: eval/receipts/images + labels.json → extractReceiptFromImage → report.md
 * 키·이미지·추출 전문은 콘솔에 찍지 않아요.
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const root = join(import.meta.dirname, "..");
const dir = join(root, "eval", "receipts");

const LabelSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  total: z.number().positive().nullable().optional(),
  currency: z.string().length(3).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  merchantNorm: z.string().optional(),
  itemCount: z.number().int().min(0).optional(),
  tax: z.number().nullable().optional(),
  tip: z.number().nullable().optional(),
});

const LabelsSchema = z.array(LabelSchema).max(200);

function loadLabels(path: string) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return LabelsSchema.parse(raw);
}

async function main() {
  const dry = process.argv.includes("--dry");
  const labelsPath = existsSync(join(dir, "labels.json"))
    ? join(dir, "labels.json")
    : join(dir, "labels.example.json");

  const labels = loadLabels(labelsPath);
  console.log(`labels=${labels.length} path=${labelsPath.includes("example") ? "example" : "labels.json"}`);

  if (dry) {
    console.log("dry-ok");
    return;
  }

  const imagesDir = join(dir, "images");
  if (!existsSync(imagesDir)) {
    console.error("eval/receipts/images 가 없어요. --dry 로 스키마만 검증하세요.");
    process.exit(1);
  }

  // 동적 import — 서버 전용 모듈
  const { extractReceiptFromImage } = await import(
    "../lib/agent/receipt-vision"
  );

  const rows: string[] = [
    "# Receipt eval report",
    "",
    `generated: ${new Date().toISOString()}`,
    `n=${labels.length}`,
    "",
  ];

  let totalOk = 0;
  let currencyOk = 0;
  let dateOk = 0;
  let itemOk = 0;
  let fail = 0;
  const latencies: number[] = [];

  for (const label of labels) {
    const imgPath = join(imagesDir, label.file);
    if (!existsSync(imgPath)) {
      fail += 1;
      rows.push(`- ${label.id}: missing-image`);
      continue;
    }
    const buf = readFileSync(imgPath);
    const t0 = Date.now();
    const res = await extractReceiptFromImage({
      base64: buf.toString("base64"),
      mime: "image/jpeg",
      userId: "eval-receipts",
      tripId: "00000000-0000-4000-8000-000000000001",
      hintCurrency: label.currency ?? "KRW",
    });
    const ms = Date.now() - t0;
    latencies.push(ms);

    if (!res.ok) {
      fail += 1;
      rows.push(`- ${label.id}: ${res.error} (${ms}ms)`);
      continue;
    }
    const d = res.draft;
    if (label.total != null && d.amount === label.total) totalOk += 1;
    if (label.currency && d.currency === label.currency) currencyOk += 1;
    if (label.date && d.spentOn === label.date) dateOk += 1;
    if (
      label.itemCount != null &&
      d.items.length === label.itemCount
    ) {
      itemOk += 1;
    }
    rows.push(`- ${label.id}: ok (${ms}ms)`);
  }

  latencies.sort((a, b) => a - b);
  const p = (q: number) =>
    latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.floor(q * (latencies.length - 1)))]
      : 0;

  rows.push(
    "",
    "## metrics",
    `- fail_rate=${fail}/${labels.length}`,
    `- total_exact=${totalOk}`,
    `- currency=${currencyOk}`,
    `- date=${dateOk}`,
    `- item_count=${itemOk}`,
    `- latency_p50_ms=${p(0.5)}`,
    `- latency_p95_ms=${p(0.95)}`,
    ""
  );

  writeFileSync(join(dir, "report.md"), rows.join("\n"), "utf8");
  console.log(`wrote report.md fail=${fail} images=${readdirSync(imagesDir).length}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "eval-failed");
  process.exit(1);
});
