"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  DEFAULT_DESTINATION_IMAGE,
  isGenericTripImage,
  pickTripImageUrl,
} from "@/lib/trips/destination-image";

type DestinationImageProps = {
  destination: string;
  country?: string;
  storedUrl?: string | null;
  alt: string;
  fill?: boolean;
  sizes?: string;
  className?: string;
  priority?: boolean;
};

export function DestinationImage({
  destination,
  country,
  storedUrl,
  alt,
  fill = true,
  sizes = "96px",
  className = "object-cover",
  priority = false,
}: DestinationImageProps) {
  const initial = pickTripImageUrl({
    storedUrl,
    destination,
    country,
  });
  const [src, setSrc] = useState(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = pickTripImageUrl({
      storedUrl,
      destination,
      country,
    });
    setSrc(next);
    setFailed(false);

    // Curated/city hit already good — skip network
    if (!isGenericTripImage(next) && next !== DEFAULT_DESTINATION_IMAGE) {
      return;
    }
    // Non-generic stored custom URL
    if (storedUrl && !isGenericTripImage(storedUrl)) {
      return;
    }

    const params = new URLSearchParams({
      destination,
      ...(country ? { country } : {}),
      ...(storedUrl ? { stored: storedUrl } : {}),
    });
    let cancelled = false;

    void fetch(`/api/destination-image?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { imageUrl?: string };
        if (!cancelled && data.imageUrl) {
          setSrc(data.imageUrl);
        }
      })
      .catch(() => {
        /* keep curated/default */
      });

    return () => {
      cancelled = true;
    };
  }, [destination, country, storedUrl]);

  const displaySrc = failed ? DEFAULT_DESTINATION_IMAGE : src;

  return (
    <Image
      src={displaySrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={className}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
