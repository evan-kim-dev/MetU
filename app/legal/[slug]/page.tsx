import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getLegalDocument, LEGAL_DOCUMENTS } from "@/lib/legal/documents";

interface LegalPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((doc) => ({ slug: doc.slug }));
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  const doc = getLegalDocument(slug);

  if (!doc) {
    return (
      <MobileShell title="문서" showBack backHref="/profile" showBottomNav={false}>
        <div className="flex flex-col items-center gap-4 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">
            문서를 찾을 수 없어요
          </p>
          <Link href="/profile">
            <PrimaryButton fullWidth={false} className="px-6">
              프로필로 돌아가기
            </PrimaryButton>
          </Link>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title={doc.title}
      showBack
      backHref="/profile"
      showBottomNav={false}
    >
      <article className="flex flex-col gap-6 px-5 pb-10 pt-5">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-ink-heading">
            {doc.title}
          </h2>
          <p className="text-sm text-ink-caption">최종 업데이트 {doc.updatedAt}</p>
        </header>

        <div className="flex flex-col gap-6">
          {doc.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-ink-heading">
                {section.heading}
              </h3>
              <div className="flex flex-col gap-2">
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-6 tracking-wide text-ink-body"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </MobileShell>
  );
}
