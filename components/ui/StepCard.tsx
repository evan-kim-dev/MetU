interface StepCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * 온보딩 각 단계의 콘텐츠 컨테이너.
 * 상단 제목/설명 + 본문 영역을 세로 오토레이아웃으로 배치한다.
 */
export function StepCard({ title, subtitle, children }: StepCardProps) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-extrabold leading-tight text-ink-heading">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm leading-relaxed text-ink-caption">{subtitle}</p>
        )}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
