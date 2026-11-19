"use client";

import { cn } from "@/lib/design/tokens";
import { BottomCTA, type BottomCTAProps } from "./BottomCTA";

export type PrimaryFooterProps = BottomCTAProps;

/** BottomCTA 래퍼 — Figma v3 가로 패딩 20px(px-5). */
export function PrimaryFooter({ className, ...props }: PrimaryFooterProps) {
  return <BottomCTA {...props} className={cn("px-5", className)} />;
}
