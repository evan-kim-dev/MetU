import Image from "next/image";

interface PostImageGalleryProps {
  images: string[];
  variant?: "card" | "detail";
}

export function PostImageGallery({
  images,
  variant = "card",
}: PostImageGalleryProps) {
  if (images.length === 0) return null;

  if (variant === "detail") {
    return (
      <div className="flex flex-col gap-2">
        {images.map((url) => (
          <div
            key={url}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="게시글 사진"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  const visible = images.slice(0, 3);
  const extraCount = images.length - visible.length;

  return (
    <div
      className={[
        "grid gap-1.5 overflow-hidden rounded-xl",
        visible.length === 1 ? "grid-cols-1" : "grid-cols-3",
      ].join(" ")}
    >
      {visible.map((url, index) => (
        <div
          key={url}
          className={[
            "relative overflow-hidden bg-surface-soft",
            visible.length === 1 ? "aspect-[16/9]" : "aspect-square",
          ].join(" ")}
        >
          <Image
            src={url}
            alt="게시글 사진"
            fill
            sizes={visible.length === 1 ? "400px" : "120px"}
            className="object-cover"
          />
          {index === 2 && extraCount > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-surface-white">
              +{extraCount}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
