"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      className={[
        "mu-focus relative h-7 w-12 shrink-0 rounded-full transition-colors duration-mu",
        checked ? "bg-mu-accent" : "bg-mu-line-strong",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "pointer-events-none absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-mu-card shadow-sm transition-transform duration-mu ease-mu",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}
