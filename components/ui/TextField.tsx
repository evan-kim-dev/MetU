import { forwardRef } from "react";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** 입력 좌측 아이콘/접두 요소 */
  leading?: React.ReactNode;
  /** 입력 우측 요소 (단위 표시 등) */
  trailing?: React.ReactNode;
  /** 큰 숫자 입력용 확대 스타일 */
  emphasized?: boolean;
}

/**
 * 공통 텍스트 입력 필드. mu 토큰 · 입력은 mu-card 위 line-strong 경계.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      leading,
      trailing,
      emphasized = false,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <label className="flex flex-col gap-2">
        {label ? (
          <span className="text-mu-label font-semibold text-mu-fg-2">
            {label}
          </span>
        ) : null}
        <div className="group flex min-h-tap items-center gap-2 rounded-mu-lg border border-mu-line-strong bg-mu-card px-4 transition-colors focus-within:border-mu-accent focus-within:ring-2 focus-within:ring-mu-accent/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-mu-sunken has-[:disabled]:opacity-60">
          {leading ? (
            <span className="text-mu-fg-3">{leading}</span>
          ) : null}
          <input
            ref={ref}
            className={[
              "w-full flex-1 bg-transparent py-3.5 text-mu-fg placeholder:text-mu-fg-3 focus:outline-none disabled:cursor-not-allowed",
              emphasized
                ? "mu-num text-right text-mu-amount font-extrabold tracking-tight"
                : "text-mu-body",
              className,
            ].join(" ")}
            {...props}
          />
          {trailing ? (
            <span className="shrink-0 font-semibold text-mu-fg-3">
              {trailing}
            </span>
          ) : null}
        </div>
      </label>
    );
  }
);

TextField.displayName = "TextField";
