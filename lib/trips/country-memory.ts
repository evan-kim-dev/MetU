import { STORAGE_KEYS } from "@/lib/constants";

export type CountryMemory = {
  memo: string;
  photos: string[];
  updatedAt: string;
};

type MemoryStore = Record<string, CountryMemory>;

const MAX_PHOTOS = 3;
const MAX_PHOTO_EDGE = 960;
const MAX_DATA_URL_CHARS = 450_000;

function readStore(): MemoryStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.countryMemories);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MemoryStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: MemoryStore) {
  window.localStorage.setItem(
    STORAGE_KEYS.countryMemories,
    JSON.stringify(store)
  );
}

export function loadCountryMemory(isoNumeric: string): CountryMemory {
  const entry = readStore()[isoNumeric];
  return {
    memo: entry?.memo ?? "",
    photos: Array.isArray(entry?.photos) ? entry.photos.slice(0, MAX_PHOTOS) : [],
    updatedAt: entry?.updatedAt ?? "",
  };
}

export function saveCountryMemo(isoNumeric: string, memo: string): CountryMemory {
  const store = readStore();
  const prev = loadCountryMemory(isoNumeric);
  const next: CountryMemory = {
    memo: memo.trim(),
    photos: prev.photos,
    updatedAt: new Date().toISOString(),
  };
  store[isoNumeric] = next;
  writeStore(store);
  return next;
}

export function saveCountryPhotos(
  isoNumeric: string,
  photos: string[]
): CountryMemory {
  const store = readStore();
  const prev = loadCountryMemory(isoNumeric);
  const next: CountryMemory = {
    memo: prev.memo,
    photos: photos.slice(0, MAX_PHOTOS),
    updatedAt: new Date().toISOString(),
  };
  store[isoNumeric] = next;
  writeStore(store);
  return next;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

/** Compress image to a small data URL for localStorage. */
export async function compressImageForMemory(
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith("image/")) {
    return { error: "이미지 파일만 올릴 수 있어요." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "사진은 8MB 이하로 올려 주세요." };
  }

  try {
    const raw = await readFileAsDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode-failed"));
      el.src = raw;
    });

    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { error: "이미지 처리에 실패했어요." };
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.72;
    let url = canvas.toDataURL("image/jpeg", quality);
    while (url.length > MAX_DATA_URL_CHARS && quality > 0.4) {
      quality -= 0.1;
      url = canvas.toDataURL("image/jpeg", quality);
    }
    if (url.length > MAX_DATA_URL_CHARS) {
      return { error: "사진이 너무 커서 저장하지 못했어요." };
    }
    return { url };
  } catch {
    return { error: "사진을 불러오지 못했어요." };
  }
}

export { MAX_PHOTOS };
