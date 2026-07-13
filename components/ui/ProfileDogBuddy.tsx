"use client";

import { useEffect, useRef, useState } from "react";
import { DOG_BALL_SRC, DOG_TRACK_SRC, PET_BUDDY_SRC } from "@/lib/easter/pet-buddy";

/** 한 보폭(초) — GIF 러닝과 비슷한 리듬 */
const STRIDE_SEC = 0.42;
/** 점프 최고 높이(px) */
const HOP_PEAK = 5;
/** 기본 이동 속도(px/s) — 강아지 */
const BASE_SPEED = 22;
/** 공 속도 배율 — 강아지보다 살짝 빠르게 */
const BALL_SPEED_RATIO = 1.18;
/** 진행 방향 기준 공이 앞서는 거리(px) */
const BALL_LEAD = 56;
const DOG_W = 80;
const BALL_W = 30;
/** 살짝 위에서 떨어지기 시작 */
const BALL_DROP_FROM = 12;
const BALL_GROUND = 0;
/** 낙하 속도(px/s) — 살짝만 */
const BALL_FALL_SPEED = 10;

type Props = {
  active: boolean;
};

/**
 * 「프로필 수정」버튼 바로 위 트랙에서
 * 잔디 위를 공이 앞서가고, 끝에서 좌우 반전해 왕복한다.
 */
export function ProfileDogBuddy({ active }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dogRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    dogX: 0,
    ballX: BALL_LEAD,
    /** 1: 오른쪽, -1: 왼쪽 */
    dir: 1 as 1 | -1,
    strideT: 0,
    speedJitter: 1,
    ballY: BALL_DROP_FROM,
    lastTs: 0,
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active || reducedMotion) return;

    let cancelled = false;

    const stop = () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const applyFacing = (dir: 1 | -1) => {
      const flip = dir < 0 ? "scaleX(-1)" : "scaleX(1)";
      if (dogRef.current) dogRef.current.style.transform = flip;
      if (ballRef.current) ballRef.current.style.transform = flip;
    };

    const tick = (now: number) => {
      if (cancelled) return;

      const track = trackRef.current;
      const dog = dogRef.current;
      const ball = ballRef.current;
      if (!track || !dog || !ball) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const dogW = dog.offsetWidth || DOG_W;
      const ballW = ball.offsetWidth || BALL_W;
      const maxDogX = Math.max(0, track.clientWidth - dogW);
      const maxBallX = Math.max(0, track.clientWidth - ballW);

      if (maxDogX <= 0 || maxBallX <= 0) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const s = stateRef.current;
      if (s.lastTs === 0) s.lastTs = now;
      const dt = Math.min(0.05, (now - s.lastTs) / 1000);
      s.lastTs = now;

      s.strideT += dt;
      if (s.strideT >= STRIDE_SEC) {
        s.strideT -= STRIDE_SEC;
        s.speedJitter = 0.92 + Math.random() * 0.16;
      }

      const phase = s.strideT / STRIDE_SEC;
      const airFactor = 0.88 + 0.24 * Math.sin(phase * Math.PI);
      const dogSpeed = BASE_SPEED * s.speedJitter * airFactor;
      const step = dogSpeed * dt * s.dir;
      s.dogX += step;
      s.ballX += step * BALL_SPEED_RATIO;

      // 끝 도달 → 좌우 반전 + 공이 진행 방향 앞에 오도록 재정렬
      if (s.dir === 1 && s.ballX >= maxBallX) {
        s.dir = -1;
        s.dogX = Math.min(maxDogX, maxBallX);
        s.ballX = Math.max(0, s.dogX - BALL_LEAD);
        applyFacing(s.dir);
      } else if (s.dir === -1 && s.ballX <= 0) {
        s.dir = 1;
        s.dogX = 0;
        s.ballX = Math.min(maxBallX, BALL_LEAD);
        applyFacing(s.dir);
      }

      s.dogX = Math.min(maxDogX, Math.max(0, s.dogX));
      s.ballX = Math.min(maxBallX, Math.max(0, s.ballX));

      if (s.ballY > BALL_GROUND) {
        s.ballY = Math.max(BALL_GROUND, s.ballY - BALL_FALL_SPEED * dt);
      }

      const hop = 4 * HOP_PEAK * phase * (1 - phase);

      dog.style.left = `${s.dogX}px`;
      dog.style.bottom = `${hop}px`;
      ball.style.left = `${s.ballX}px`;
      ball.style.bottom = `${s.ballY}px`;

      rafRef.current = window.requestAnimationFrame(tick);
    };

    stateRef.current = {
      dogX: 0,
      ballX: BALL_LEAD,
      dir: 1,
      strideT: 0,
      speedJitter: 1,
      ballY: BALL_DROP_FROM,
      lastTs: 0,
    };
    applyFacing(1);

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, reducedMotion]);

  if (!active || reducedMotion) return null;

  return (
    <div
      ref={trackRef}
      className="pointer-events-none relative mt-3 mb-0 h-14 w-full overflow-hidden"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${DOG_TRACK_SRC}?v=1`}
        alt=""
        draggable={false}
        decoding="async"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full w-full select-none object-cover object-bottom"
      />
      <div
        ref={dogRef}
        className="absolute bottom-0 left-0 z-[1] h-12 w-[80px] will-change-[left,bottom,transform]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${PET_BUDDY_SRC.dog}?v=6`}
          alt=""
          width={80}
          height={48}
          draggable={false}
          decoding="async"
          className="h-full w-full select-none object-contain object-bottom drop-shadow-md"
        />
      </div>
      <div
        ref={ballRef}
        className="absolute bottom-0 left-0 z-[2] h-[30px] w-[30px] will-change-[left,bottom,transform]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${DOG_BALL_SRC}?v=10`}
          alt=""
          width={30}
          height={30}
          draggable={false}
          decoding="async"
          className="h-full w-full select-none object-contain object-bottom"
        />
      </div>
    </div>
  );
}
