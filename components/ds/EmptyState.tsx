import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/design/tokens";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-4 py-10 text-center",
        className
      )}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mu-sunken text-mu-fg-2">
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="text-mu-heading text-mu-fg">{title}</h3>
      <p className="mt-2 max-w-prose text-mu-body text-mu-fg-3">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
