import { cn } from "@/lib/utils";

/** Designed "nothing here yet" block — never leave a screen blank. */
export function EmptyState({
  emoji,
  title,
  body,
  action,
  className,
}: {
  emoji: string;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center rounded-[var(--radius-card)] px-6 py-9 text-center",
        className,
      )}
    >
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-surface-strong text-3xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="font-display-tight text-2xl font-bold">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
