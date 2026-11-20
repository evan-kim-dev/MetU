"use client";

import Image from "next/image";

/**
 * 로그인 중앙 비주얼. 여행자 마스코트 + 걷기 모션(globals.css).
 */
export function LoginWorldHero() {
  return (
    <div
      className="login-traveler-walk w-full max-w-[22rem]"
      data-testid="login-world-hero"
      aria-hidden
    >
      <Image
        src="/brand/login-traveler.png"
        alt=""
        width={1024}
        height={1024}
        priority
        unoptimized
        className="mx-auto h-auto w-full max-h-[min(42vh,22rem)] object-contain object-center"
        draggable={false}
      />
    </div>
  );
}
