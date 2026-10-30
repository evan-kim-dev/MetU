import type { DocsCountryId } from "@/lib/checklist/resolve-docs-country";

export type DocsChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  tip?: string;
};

export type CountryDocsEntry = {
  label: string;
  docs: DocsChecklistItem[];
};

/**
 * AI 실패 시 폴백용 국가별 서류 (삭제 금지 — 저장된 체크 id 유지).
 */
export const COUNTRY_DOCS: Record<DocsCountryId, CountryDocsEntry> = {
  japan: {
    label: "일본",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "visitjapan", label: "Visit Japan 등록 QR (권장)", required: false },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  thailand: {
    label: "태국",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "hotel-voucher", label: "숙소 바우처", required: true },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  vietnam: {
    label: "베트남",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "evisa", label: "전자비자 승인서(필요 시)", required: false },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  taiwan: {
    label: "대만",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "entry-form", label: "입국 신고 정보", required: false },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  philippines: {
    label: "필리핀",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "etravel", label: "eTravel 등록 정보", required: true },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  singapore: {
    label: "싱가포르",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "sg-arrival", label: "SG Arrival Card 승인", required: true },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  malaysia: {
    label: "말레이시아",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "mdac", label: "MDAC 등록 확인", required: true },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  indonesia: {
    label: "인도네시아",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "evisa", label: "전자비자/VOA 승인 (필요 시)", required: false },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  china: {
    label: "중국",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "visa", label: "비자 승인서 (필요 시)", required: false },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  hongkong: {
    label: "홍콩",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "hotel-voucher", label: "숙소 예약 확인서", required: false },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  cambodia: {
    label: "캄보디아",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "evisa", label: "전자비자 승인 (필요 시)", required: false },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  europe: {
    label: "유럽",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      {
        id: "visa",
        label: "쉥겐 비자/ETIAS 승인 (필요 시)",
        required: false,
        tip: "목적지·체류 기간에 따라 쉥겐 비자 또는 ETIAS가 필요할 수 있어요.",
      },
      { id: "hotel-voucher", label: "숙소 예약 확인서", required: true },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  uk: {
    label: "영국",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "eta", label: "영국 ETA 승인 화면", required: true },
      { id: "hotel-voucher", label: "숙소 예약 확인서", required: true },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
  usa: {
    label: "미국",
    docs: [
      { id: "passport", label: "여권(유효기간 확인)", required: true },
      { id: "esta", label: "ESTA 승인 화면", required: true },
      { id: "return-ticket", label: "왕복 항공권 E-티켓", required: true },
      { id: "insurance", label: "해외여행자 보험 증서", required: false },
    ],
  },
};

export const DOCS_CHECKLIST_DISCLAIMER =
  "정확하지 않을 수 있어요. 출국 전 외교부 해외안전여행(0404.go.kr)·대사관에서 확인하세요.";

const KNOWN_COUNTRY_IDS = new Set<string>(Object.keys(COUNTRY_DOCS));

export function isDocsCountryId(value: string): value is DocsCountryId {
  return KNOWN_COUNTRY_IDS.has(value);
}

/** 라벨·후보 id를 기존 폴백 id에 매칭. 신규는 ai-<slug>. */
export function assignDocsChecklistIds(
  country: DocsCountryId,
  incoming: Array<{
    id?: string;
    label: string;
    required: boolean;
    tip?: string;
  }>
): DocsChecklistItem[] {
  const fallback = COUNTRY_DOCS[country].docs;
  const used = new Set<string>();

  const matchFallbackId = (rawId: string | undefined, label: string): string | null => {
    if (rawId) {
      const byId = fallback.find((d) => d.id === rawId);
      if (byId && !used.has(byId.id)) return byId.id;
    }
    const normalized = label.replace(/\s+/g, "").toLowerCase();
    for (const doc of fallback) {
      if (used.has(doc.id)) continue;
      const fb = doc.label.replace(/\s+/g, "").toLowerCase();
      if (
        normalized.includes(fb.slice(0, Math.min(6, fb.length))) ||
        fb.includes(normalized.slice(0, Math.min(6, normalized.length)))
      ) {
        return doc.id;
      }
      // keyword aliases
      if (/여권|passport/i.test(label) && doc.id === "passport") return doc.id;
      if (/왕복|e-?티켓|항공권|return/i.test(label) && doc.id === "return-ticket")
        return doc.id;
      if (/보험|insurance/i.test(label) && doc.id === "insurance") return doc.id;
      if (/숙소|호텔|바우처|voucher/i.test(label) && doc.id === "hotel-voucher")
        return doc.id;
      if (/비자|visa|etias|voa/i.test(label) && doc.id === "visa") return doc.id;
      if (/evisa|전자비자/i.test(label) && doc.id === "evisa") return doc.id;
      if (/esta/i.test(label) && doc.id === "esta") return doc.id;
      if (/\beta\b|영국\s*eta/i.test(label) && doc.id === "eta") return doc.id;
      if (/visit\s*japan/i.test(label) && doc.id === "visitjapan") return doc.id;
      if (/etravel/i.test(label) && doc.id === "etravel") return doc.id;
      if (/sg\s*arrival|arrival\s*card/i.test(label) && doc.id === "sg-arrival")
        return doc.id;
      if (/mdac/i.test(label) && doc.id === "mdac") return doc.id;
      if (/입국\s*신고|entry/i.test(label) && doc.id === "entry-form") return doc.id;
    }
    return null;
  };

  const slugify = (label: string): string => {
    const base = label
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return base || "doc";
  };

  const result: DocsChecklistItem[] = [];
  for (const item of incoming) {
    const label = item.label.trim();
    if (!label) continue;
    let id = matchFallbackId(item.id, label);
    if (!id) {
      const slug = slugify(label);
      let candidate = `ai-${slug}`;
      let n = 2;
      while (used.has(candidate)) {
        candidate = `ai-${slug}-${n}`;
        n += 1;
      }
      id = candidate;
    }
    used.add(id);
    result.push({
      id,
      label,
      required: Boolean(item.required),
      tip: item.tip?.trim() || undefined,
    });
  }

  // Ensure known fallback ids that were checked historically still appear if AI omitted them
  for (const doc of fallback) {
    if (used.has(doc.id)) continue;
    // Only force required core docs that users likely already checked
    if (doc.id === "passport" || doc.id === "return-ticket") {
      used.add(doc.id);
      result.unshift({ ...doc });
    }
  }

  return result;
}
