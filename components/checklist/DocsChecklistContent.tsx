"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  fileToDataUrl,
  uploadChecklistDocFile,
} from "@/lib/checklist/docs-upload";
import {
  getDocsChecklistScopeKey,
  loadDocsChecklistState,
  saveDocsChecklistState,
  type StoredDocUpload,
} from "@/lib/checklist/docs-storage";
import { useTrips } from "@/lib/trips/TripProvider";
import {
  getPrimaryActiveTrip,
  resolveDocsCountryFromTrip,
  type DocsCountryId,
} from "@/lib/checklist/resolve-docs-country";
import { useWithactChecklist } from "@/lib/checklist/useWithactChecklist";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type CountryId = DocsCountryId;

type DocItem = {
  id: string;
  label: string;
  required: boolean;
  tip?: string;
};

type UploadFile = StoredDocUpload;

const COUNTRY_DOCS: Record<CountryId, { label: string; docs: DocItem[] }> = {
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

export function DocsChecklistContent() {
  const { user, provider } = useAuth();
  const { activeTrips, isReady: isTripReady } = useTrips();
  const primaryTrip = useMemo(() => getPrimaryActiveTrip(activeTrips), [activeTrips]);
  const autoCountry = useMemo(
    () => (primaryTrip ? resolveDocsCountryFromTrip(primaryTrip) : null),
    [primaryTrip]
  );
  const [country, setCountry] = useState<CountryId>("japan");
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [uploads, setUploads] = useState<Record<string, UploadFile[]>>({});
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { persistItem } = useWithactChecklist(primaryTrip?.budget ?? 0);

  const scopeKey = useMemo(
    () => getDocsChecklistScopeKey(country, primaryTrip?.id),
    [country, primaryTrip?.id]
  );

  const countryInfo = COUNTRY_DOCS[country];
  const docs = countryInfo.docs;

  const progress = useMemo(() => {
    const total = docs.length;
    const done = docs.filter((doc) => checkedMap[doc.id]).length;
    return { done, total };
  }, [checkedMap, docs]);

  useEffect(() => {
    if (!isTripReady || !autoCountry) return;
    setCountry(autoCountry);
  }, [isTripReady, autoCountry]);

  useEffect(() => {
    setIsHydrated(false);
    const saved = loadDocsChecklistState(scopeKey);
    setCheckedMap(saved?.checkedMap ?? {});
    setUploads(saved?.uploads ?? {});
    setUploadError("");
    setIsHydrated(true);
  }, [scopeKey]);

  useEffect(() => {
    if (!isHydrated) return;
    saveDocsChecklistState(scopeKey, {
      checkedMap,
      uploads,
    });
  }, [checkedMap, uploads, isHydrated, scopeKey]);

  function toggleCheck(docId: string) {
    setCheckedMap((prev) => {
      const next = { ...prev, [docId]: !prev[docId] };
      const done = docs.filter((doc) => next[doc.id]).length;
      void persistItem({
        itemType: "DOCUMENT",
        itemStatus: done === docs.length ? "COMPLETED" : "SEARCHED",
        itemName: `${countryInfo.label} 서류`,
        itemSummary: `${done}/${docs.length} 완료`,
      });
      return next;
    });
  }

  function openFilePicker(docId: string) {
    fileInputRefs.current[docId]?.click();
  }

  async function onFilesSelected(docId: string, fileList: FileList | null) {
    if (!fileList?.length || uploadingDocId) return;

    setUploadError("");
    setUploadingDocId(docId);

    const supabase = getBrowserSupabase();
    const canUseRemoteStorage = Boolean(
      supabase && user?.id && provider !== "guest"
    );

    const nextFiles: UploadFile[] = [];

    for (const file of Array.from(fileList)) {
      const id = `${docId}-${crypto.randomUUID()}`;
      let url: string | null = null;

      if (canUseRemoteStorage && supabase && user?.id) {
        const uploaded = await uploadChecklistDocFile(supabase, {
          userId: user.id,
          countryId: country,
          docId,
          file,
        });

        if ("url" in uploaded) {
          url = uploaded.url;
        } else {
          const fallback = await fileToDataUrl(file);
          if (typeof fallback === "string") {
            url = fallback;
          } else {
            setUploadError(uploaded.error || fallback.error);
            break;
          }
        }
      } else {
        const fallback = await fileToDataUrl(file);
        if (typeof fallback === "string") {
          url = fallback;
        } else {
          setUploadError(fallback.error);
          break;
        }
      }

      if (!url) continue;
      nextFiles.push({ id, name: file.name, url });
    }

    if (nextFiles.length > 0) {
      setUploads((prev) => ({
        ...prev,
        [docId]: [...(prev[docId] ?? []), ...nextFiles],
      }));
    }

    setUploadingDocId(null);
  }

  function removeUpload(docId: string, uploadId: string) {
    setUploads((prev) => {
      const target = prev[docId] ?? [];
      const removed = target.find((item) => item.id === uploadId);
      if (removed?.url.startsWith("blob:")) {
        URL.revokeObjectURL(removed.url);
      }
      return {
        ...prev,
        [docId]: target.filter((item) => item.id !== uploadId),
      };
    });
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-5">
      <header className="flex flex-col gap-2">
        <h2 className="text-heading font-bold tracking-tight text-ink-heading">
          입국/필수 서류 체크리스트
        </h2>
        <p className="text-sm leading-6 text-ink-body">
          진행 중인 여행 국가에 맞춰 필요한 서류를 확인하고, 증빙 이미지를 업로드해 관리할
          수 있어요.
        </p>
      </header>

      <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-ink-heading">여행 국가</p>
          <span className="text-xs font-semibold text-brand">
            {progress.done}/{progress.total} 완료
          </span>
        </div>
        {primaryTrip && autoCountry ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-brand-strong">
                {COUNTRY_DOCS[autoCountry].label}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-caption">
                {primaryTrip.destination} · {primaryTrip.country}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-2xs font-bold text-brand">
              자동 매칭
            </span>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-ink-caption">
              진행 중인 여행이 없거나 지원 지역이 아니에요. 지역을 직접 선택해 주세요.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(COUNTRY_DOCS) as CountryId[]).map((countryId) => {
                const active = country === countryId;
                return (
                  <button
                    key={countryId}
                    type="button"
                    onClick={() => setCountry(countryId)}
                    className={[
                      "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                      active
                        ? "border-brand bg-brand/10 text-brand-strong"
                        : "border-line-soft bg-surface-white text-ink-body",
                    ].join(" ")}
                  >
                    {COUNTRY_DOCS[countryId].label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4.5 w-4.5 text-brand" />
          <h3 className="text-sm font-bold text-ink-heading">
            {countryInfo.label} 서류 목록
          </h3>
        </div>
        {uploadError ? (
          <p className="mb-3 text-xs text-red-500">{uploadError}</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {docs.map((doc) => {
            const checked = Boolean(checkedMap[doc.id]);
            const docUploads = uploads[doc.id] ?? [];
            return (
              <li
                key={doc.id}
                className="rounded-lg border border-line-soft bg-surface-base p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleCheck(doc.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <CheckCircle2
                      className={`h-4.5 w-4.5 shrink-0 ${
                        checked ? "text-brand" : "text-ink-caption"
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          checked ? "text-brand-strong line-through" : "text-ink-heading"
                        }`}
                      >
                        {doc.label}
                        {doc.required ? (
                          <span className="ml-1 text-2xs font-bold text-rose-500">
                            필수
                          </span>
                        ) : null}
                      </p>
                      {doc.tip ? (
                        <p className="mt-1 text-xs text-ink-caption">{doc.tip}</p>
                      ) : null}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[doc.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void onFilesSelected(doc.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingDocId === doc.id}
                      onClick={() => openFilePicker(doc.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/5 px-2.5 text-xs font-semibold text-brand disabled:opacity-50"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      {uploadingDocId === doc.id ? "업로드 중..." : "사진 업로드"}
                    </button>
                  </div>
                </div>

                {docUploads.length > 0 ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {docUploads.map((file) => (
                      <div
                        key={file.id}
                        className="relative overflow-hidden rounded-lg border border-line-soft bg-surface-white"
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          className="h-20 w-full object-cover"
                        />
                        <button
                          type="button"
                          aria-label="업로드 이미지 삭제"
                          onClick={() => removeUpload(doc.id, file.id)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
