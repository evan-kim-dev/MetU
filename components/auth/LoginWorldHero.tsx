"use client";

import { useEffect, useRef } from "react";

/**
 * H.264 인코딩 후 실제 배경 평균(~226,228,232).
 * 원본 #F7F8FA 와 달라서 그 값으로 키잉하면 배경이 남아요.
 */
const KEY_R = 226;
const KEY_G = 228;
const KEY_B = 232;
const KEY_HARD = 30;
const KEY_SOFT = 48;

function chromaKey(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const frame = ctx.getImageData(0, 0, w, h);
  const data = frame.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const dist = Math.hypot(r - KEY_R, g - KEY_G, b - KEY_B);
    const nearBlack = r < 20 && g < 20 && b < 20;
    if (nearBlack || dist <= KEY_HARD) {
      data[i + 3] = 0;
    } else if (dist < KEY_SOFT) {
      data[i + 3] = Math.round(
        (data[i + 3] ?? 0) * ((dist - KEY_HARD) / (KEY_SOFT - KEY_HARD))
      );
    }
  }
  ctx.putImageData(frame, 0, 0);
}

/**
 * 로그인 중앙 비주얼.
 * 숨긴 video 프레임을 canvas 크로마키로 그려 배경을 투명 처리해요.
 */
export function LoginWorldHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");

    let raf = 0;
    let stopped = false;

    const syncSize = () => {
      const w = video.videoWidth || 960;
      const h = video.videoHeight || 960;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const paint = () => {
      if (stopped) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        syncSize();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        chromaKey(ctx, canvas.width, canvas.height);
      }
      raf = window.requestAnimationFrame(paint);
    };

    const play = () => {
      void video.play().catch(() => {
        /* 자동재생 차단 시 빈 캔버스 */
      });
    };

    /** 루프 이음새의 검은/잔여 프레임을 피해요 */
    const softLoop = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0.25) return;
      if (video.currentTime >= video.duration - 0.08) {
        video.currentTime = 0.02;
      }
    };

    paint();
    play();
    video.addEventListener("canplay", play);
    video.addEventListener("loadeddata", play);
    video.addEventListener("timeupdate", softLoop);
    video.addEventListener("ended", () => {
      video.currentTime = 0.02;
      play();
    });

    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      video.removeEventListener("canplay", play);
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("timeupdate", softLoop);
    };
  }, []);

  return (
    <div
      className="relative w-full max-w-[16rem]"
      data-testid="login-world-hero"
      aria-hidden
    >
      <video
        ref={videoRef}
        src="/brand/login-traveler-walk.mp4?v=5"
        className="pointer-events-none absolute h-px w-px opacity-0"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      />
      <canvas
        ref={canvasRef}
        className="mx-auto h-auto w-full max-h-[min(28vh,14rem)] object-contain object-center"
      />
    </div>
  );
}
