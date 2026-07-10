"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ImagePlus, Users, X } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  CATEGORY_LABELS,
  type CommunityPost,
  type WritablePostCategory,
} from "@/lib/mock/community";
import {
  MAX_POST_IMAGES,
  uploadCommunityPostImage,
} from "@/lib/community/post-images";
import type { CreatePostInput } from "@/lib/community/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const WRITE_CATEGORIES: WritablePostCategory[] = [
  "party",
  "question",
  "review",
  "tip",
];

interface DraftImage {
  id: string;
  previewUrl: string;
  uploadedUrl?: string;
  file?: File;
}

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
  const { user, provider } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isEditing = Boolean(editingPost);
  const [category, setCategory] = useState<WritablePostCategory>(initialCategory);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [body, setBody] = useState("");
  const [startDate, setStartDate] = useState(defaultDate(14));
  const [endDate, setEndDate] = useState(defaultDate(17));
  const [needed, setNeeded] = useState(4);
  const [budgetPerPerson, setBudgetPerPerson] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [uploading, setUploading] = useState(false);
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
      setImages(
        (editingPost.images ?? []).map((url) => ({
          id: url,
          previewUrl: url,
          uploadedUrl: url,
        }))
      );
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
    setImages([]);
    setError(null);
  }, [editingPost, initialCategory, open]);

  const isParty = category === "party";

  const canSubmit = useMemo(() => {
    if (!title.trim() || !destination.trim() || !body.trim()) return false;
    if (isParty && (!startDate || !endDate || needed < 2)) return false;
    return true;
  }, [body, destination, endDate, isParty, needed, startDate, title]);

  if (!open) return null;

  function handlePickImages(files: FileList | null) {
    if (!files?.length) return;

    const remaining = MAX_POST_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`사진은 최대 ${MAX_POST_IMAGES}장까지 올릴 수 있어요.`);
      return;
    }

    const nextFiles = Array.from(files).slice(0, remaining);
    const nextImages = nextFiles.map((file) => ({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      file,
    }));

    setImages((prev) => [...prev, ...nextImages]);
    setError(null);
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target?.file) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((image) => image.id !== id);
    });
  }

  async function handleSubmit() {
    if (!canSubmit || uploading) {
      setError("필수 항목을 입력해주세요.");
      return;
    }

    const pendingUploads = images.filter((image) => image.file);
    if (pendingUploads.length > 0) {
      if (!user?.id || provider === "guest") {
        setError("사진 업로드는 로그인 후 이용할 수 있어요.");
        return;
      }

      const supabase = getBrowserSupabase();
      if (!supabase) {
        setError("사진 업로드를 위해 Supabase 연결이 필요해요.");
        return;
      }
    }

    setUploading(true);
    setError(null);

    const imageUrls: string[] = [];
    const supabase = getBrowserSupabase();

    for (const image of images) {
      if (image.uploadedUrl) {
        imageUrls.push(image.uploadedUrl);
        continue;
      }

      if (!image.file || !supabase || !user?.id) continue;

      const uploaded = await uploadCommunityPostImage(
        supabase,
        user.id,
        image.file
      );

      if ("error" in uploaded) {
        setError(uploaded.error);
        setUploading(false);
        return;
      }

      imageUrls.push(uploaded.url);
    }

    onSubmit({
      category,
      title: title.trim(),
      destination: destination.trim(),
      body: body.trim(),
      imageUrls,
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
      images.forEach((image) => {
        if (image.file) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
      setTitle("");
      setDestination("");
      setBody("");
      setBudgetPerPerson("");
      setImages([]);
    }
    setUploading(false);
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-caption">사진</span>
              <span className="text-[11px] text-ink-caption">
                {images.length}/{MAX_POST_IMAGES}
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              disabled={uploading || images.length >= MAX_POST_IMAGES}
              onChange={(e) => {
                handlePickImages(e.target.files);
                e.target.value = "";
              }}
            />

            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {images.length < MAX_POST_IMAGES ? (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-muted bg-surface-soft text-ink-caption transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px] font-semibold">추가</span>
                </button>
              ) : null}

              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line-soft"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt="첨부 사진 미리보기"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="사진 삭제"
                    disabled={uploading}
                    onClick={() => removeImage(image.id)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-surface-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-xs text-danger">{error}</p>
        ) : null}

        <PrimaryButton
          className="mt-4"
          disabled={!canSubmit || uploading}
          onClick={() => {
            void handleSubmit();
          }}
        >
          {uploading
            ? "업로드 중..."
            : isEditing
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
