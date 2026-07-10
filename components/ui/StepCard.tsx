interface StepCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * 온보딩 각 단계의 콘텐츠 컨테이너.
 */
export function StepCard({ title, subtitle, children }: StepCardProps) {
  return (
    <section className="flex flex-col gap-6 animate-fade-up">
      <header className="flex flex-col gap-2">
        <span className="ai-chip w-fit">AI 맞춤 설정</span>
        <h2 className="text-2xl font-extrabold leading-tight text-ink-heading">{title}</h2>
        {subtitle ? (
          <p className="text-sm leading-relaxed text-ink-caption">{subtitle}</p>
        ) : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
