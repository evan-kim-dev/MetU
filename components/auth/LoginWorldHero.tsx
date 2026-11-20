"use client";

import { useEffect, useRef } from "react";

/**
 * 로그인 중앙 비주얼. 걷기 루프 MP4 (자동 재생·무음·루프).
 * 배경은 mu-bg(#F7F8FA)에 맞춰 두어 투명처럼 보이게 해요.
 */
export function LoginWorldHero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");

    const play = () => {
      void el.play().catch(() => {
        /* 자동재생 차단 시 poster 유지 */
      });
    };

    /** 끝 프레임 블랙/끊김을 피하려고 루프 직전에서 되감아요. */
    const softLoop = () => {
      if (!Number.isFinite(el.duration) || el.duration <= 0.2) return;
      if (el.currentTime >= el.duration - 0.12) {
        el.currentTime = 0.04;
      }
    };

    play();
    el.addEventListener("canplay", play);
    el.addEventListener("loadeddata", play);
    el.addEventListener("timeupdate", softLoop);
    el.addEventListener("ended", () => {
      el.currentTime = 0.04;
      play();
    });
    return () => {
      el.removeEventListener("canplay", play);
      el.removeEventListener("loadeddata", play);
      el.removeEventListener("timeupdate", softLoop);
    };
  }, []);

  return (
    <div
      className="w-full max-w-[16rem]"
      data-testid="login-world-hero"
      aria-hidden
    >
      <video
        ref={videoRef}
        src="/brand/login-traveler-walk.mp4?v=3"
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
