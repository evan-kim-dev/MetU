import { forwardRef } from "react";

interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** 입력 좌측 아이콘/접두 요소 */
  leading?: React.ReactNode;
  /** 입력 우측 요소 (단위 표시 등) */
  trailing?: React.ReactNode;
  /** 큰 숫자 입력용 확대 스타일 */
  emphasized?: boolean;
}

/**
 * 공통 텍스트 입력 필드.
 * focus 시 브랜드 컬러 테두리 + 링으로 하이라이트된다.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, leading, trailing, emphasized = false, className = "", ...props }, ref) => {
    return (
      <label className="flex flex-col gap-2">
        {label && (
          <span className="text-sm font-semibold text-ink-body">{label}</span>
        )}
        <div className="group flex items-center gap-2 rounded-2xl border border-line-muted bg-surface-white px-4 transition-all focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
          {leading && <span className="text-ink-caption">{leading}</span>}
          <input
            ref={ref}
            className={[
              "w-full flex-1 bg-transparent py-3.5 text-ink-heading placeholder:text-ink-caption/70 focus:outline-none",
              emphasized ? "text-3xl font-extrabold tracking-tight" : "text-base",
              className,
            ].join(" ")}
            {...props}
          />
          {trailing && (
            <span className="shrink-0 font-semibold text-ink-caption">
              {trailing}
            </span>
          )}
        </div>
      </label>
    );
  }
);

TextField.displayName = "TextField";
