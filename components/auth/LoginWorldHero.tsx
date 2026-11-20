"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * 로그인 중앙 비주얼. 걷기 루프 영상(또는 reduced-motion 시 정지 PNG).
 */
export function LoginWorldHero() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div
      className="w-full max-w-[18rem]"
      data-testid="login-world-hero"
      aria-hidden
    >
      {reduceMotion ? (
        <Image
          src="/brand/login-traveler.png"
          alt=""
          width={1024}
          height={1024}
          priority
          unoptimized
          className="mx-auto h-auto w-full max-h-[min(32vh,16rem)] object-contain object-center"
          draggable={false}
        />
      ) : (
        <video
          src="/brand/login-traveler-walk.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/brand/login-traveler.png"
          className="mx-auto h-auto w-full max-h-[min(32vh,16rem)] object-contain object-center"
        />
      )}
    </div>
  );
}
