"use client";

import { useEffect, useRef } from "react";

/**
 * 로그인 중앙 비주얼. 걷기 루프 MP4 (자동 재생·무음·루프).
 * 장식용이라 prefers-reduced-motion 이어도 영상 자체를 유지해요.
 */
export function LoginWorldHero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    const play = () => {
      void el.play().catch(() => {
        /* 브라우저 자동재생 차단 시 poster 유지 */
      });
    };
    play();
    el.addEventListener("loadeddata", play);
    return () => el.removeEventListener("loadeddata", play);
  }, []);

  return (
    <div
      className="w-full max-w-[16rem]"
      data-testid="login-world-hero"
      aria-hidden
    >
      <video
        ref={videoRef}
        src="/brand/login-traveler-walk.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/brand/login-traveler.png"
        className="mx-auto h-auto w-full max-h-[min(28vh,14rem)] object-contain object-center"
      />
    </div>
  );
}
