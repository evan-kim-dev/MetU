/** ExchangeRate-API 무료 사용 출처 표기. */
export function FxAttribution({ className }: { className?: string }) {
  return (
    <p
      className={
        className ?? "mt-1 text-[10px] leading-snug text-ink-muted"
      }
    >
      환율:{" "}
      <a
        href="https://www.exchangerate-api.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        ExchangeRate-API
      </a>{" "}
      (open.er-api.com)
    </p>
  );
}
