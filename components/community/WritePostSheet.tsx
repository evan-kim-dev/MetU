"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Users, X } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  CATEGORY_LABELS,
  type CommunityPost,
  type WritablePostCategory,
} from "@/lib/mock/community";
import type { CreatePostInput } from "@/lib/community/types";

const WRITE_CATEGORIES: WritablePostCategory[] = [
  "party",
  "question",
  "review",
  "tip",
];

interface WritePostSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreatePostInput) => void;
  initialCategory?: WritablePostCategory;
  editingPost?: CommunityPost | null;
}

function defaultDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function WritePostSheet({
  open,
  onClose,
  onSubmit,
  initialCategory = "party",
  editingPost = null,
}: WritePostSheetProps) {
  const isEditing = Boolean(editingPost);
  const [category, setCategory] = useState<WritablePostCategory>(initialCategory);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [body, setBody] = useState("");
  const [startDate, setStartDate] = useState(defaultDate(14));
  const [endDate, setEndDate] = useState(defaultDate(17));
  const [needed, setNeeded] = useState(4);
  const [budgetPerPerson, setBudgetPerPerson] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (editingPost) {
      setCategory(editingPost.category);
      setTitle(editingPost.title);
      setDestination(editingPost.destination);
      setBody(editingPost.preview);
      setStartDate(editingPost.party?.startDate ?? defaultDate(14));
      setEndDate(editingPost.party?.endDate ?? defaultDate(17));
      setNeeded(editingPost.party?.needed ?? 4);
      setBudgetPerPerson(editingPost.party?.budgetPerPerson ?? "");
      setError(null);
      return;
    }

    setCategory(initialCategory);
    setTitle("");
    setDestination("");
    setBody("");
    setStartDate(defaultDate(14));
    setEndDate(defaultDate(17));
    setNeeded(4);
    setBudgetPerPerson("");
    setError(null);
  }, [editingPost, initialCategory, open]);

  const isParty = category === "party";

  const canSubmit = useMemo(() => {
    if (!title.trim() || !destination.trim() || !body.trim()) return false;
    if (isParty && (!startDate || !endDate || needed < 2)) return false;
    return true;
  }, [body, destination, endDate, isParty, needed, startDate, title]);

  if (!open) return null;

  function handleSubmit() {
    if (!canSubmit) {
      setError("필수 항목을 입력해주세요.");
      return;
    }

    onSubmit({
      category,
      title: title.trim(),
      destination: destination.trim(),
      body: body.trim(),
      party: isParty
        ? {
            startDate,
            endDate,
            needed,
            current: editingPost?.party?.current ?? 1,
            budgetPerPerson: budgetPerPerson.trim() || undefined,
            members: editingPost?.party?.members ?? [],
          }
        : undefined,
    });

    if (!isEditing) {
      setTitle("");
      setDestination("");
      setBody("");
      setBudgetPerPerson("");
    }
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[88dvh] w-full max-w-mobile overflow-y-auto rounded-t-2xl bg-surface-white px-5 pb-8 pt-4 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-heading">
            {isEditing ? "게시글 수정" : "글쓰기"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-ink-body"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
          {WRITE_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              disabled={isEditing}
              onClick={() => setCategory(item)}
              className={[
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-bold",
                category === item
                  ? item === "party"
                    ? "ai-gradient-bg text-white"
                    : "bg-brand text-surface-white"
                  : "border border-line-soft bg-surface-white text-ink-caption",
              ].join(" ")}
            >
              {CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>

        {isParty ? (
          <div className="mb-4 rounded-xl border border-brand/15 bg-surface-soft px-3 py-2.5 text-xs leading-5 text-brand-strong">
            게임 파티 구하듯, 같이 여행할 일정·인원·예산을 적어 동행을 구해보세요.
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isParty ? "예: 도쿄 3박4일 동행 2명 구해요" : "제목을 입력하세요"}
              className="h-11 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">여행지</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="예: 도쿄, 파리"
              className="h-11 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            />
          </label>

          {isParty ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-caption">출발일</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-11 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-caption">귀국일</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-caption">모집 인원</span>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={needed}
                    onChange={(e) =>
                      setNeeded(Math.max(2, Math.min(20, Number(e.target.value) || 2)))
                    }
                    className="h-11 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-caption">1인 예산 (선택)</span>
                  <input
                    value={budgetPerPerson}
                    onChange={(e) => setBudgetPerPerson(e.target.value)}
                    placeholder="예: 80만원"
                    className="h-11 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
                  />
                </label>
              </div>
            </>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">내용</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={
                isParty
                  ? "여행 스타일, 선호 일정, 함께하고 싶은 분의 조건 등을 적어주세요."
                  : "내용을 입력하세요"
              }
              className="resize-none rounded-lg border border-line-soft px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 text-xs text-danger">{error}</p>
        ) : null}

        <PrimaryButton className="mt-4" disabled={!canSubmit} onClick={handleSubmit}>
          {isEditing
            ? isParty
              ? "동행 모집글 수정"
              : "게시글 수정"
            : isParty
              ? "동행 모집글 등록"
              : "게시글 등록"}
        </PrimaryButton>

        {isParty ? (
          <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-caption">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              동행 모집
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              일정 공유
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
