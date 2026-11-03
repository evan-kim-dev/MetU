import { cn } from "@/lib/design/tokens";

export type SkeletonProps = {
  h?: number | string;
  w?: number | string;
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
};

const ROUND: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  sm: "rounded-mu-sm",
  md: "rounded-mu-md",
  lg: "rounded-mu-lg",
  xl: "rounded-mu-xl",
  full: "rounded-full",
};

export function Skeleton({
  h = 16,
  w = "100%",
  rounded = "md",
  className,
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block overflow-hidden bg-mu-sunken",
        ROUND[rounded],
        className
      )}
      style={{
        height: typeof h === "number" ? `${h}px` : h,
        width: typeof w === "number" ? `${w}px` : w,
      }}
    >
      <span className="absolute inset-0 motion-safe:animate-shimmer bg-gradient-to-r from-transparent via-mu-card/60 to-transparent" />
    </span>
  );
}
