import type { ReactNode } from "react";

/**
 * Branded page header with the SkyHR dotted-grid atmosphere
 * (ported from apps/mobile DottedBackground behind the home greeting).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="sky-rise relative overflow-hidden rounded-2xl border border-border bg-tint/40 px-6 py-7 dark:bg-accent">
      <div
        className="pointer-events-none absolute inset-0 text-primary/15 dark:text-white/10 sky-dotgrid"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-accent-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
