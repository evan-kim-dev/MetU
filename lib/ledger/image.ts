import { receiptMaxImageBytes } from "@/lib/ledger/image-limits";

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Resize and re-encode to JPEG for receipt upload (client-side).
 * Uses EXIF orientation via createImageBitmap when available.
 */
export async function resizeImageToJpeg(
  file: File,
  maxEdge = 1600,
  quality = 0.8
): Promise<File> {
  const type = (file.type || "").toLowerCase();
  if (type.includes("heic") || type.includes("heif")) {
    throw new Error("JPEG/PNG 로 다시 올려 주세요");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
  } catch {
    throw new Error("JPEG/PNG 로 다시 올려 주세요");
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("이미지 처리에 실패했어요");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const limit = receiptMaxImageBytes();
  let q = quality;
  let blob = await canvasToJpegBlob(canvas, q);
  while (blob && blob.size > limit && q > 0.35) {
    q -= 0.1;
    blob = await canvasToJpegBlob(canvas, q);
  }

  if (!blob || blob.size > limit) {
    throw new Error("이미지가 너무 커요. 더 작은 사진을 선택해 주세요");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "receipt";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
