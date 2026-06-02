export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <header className="mb-5 flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
      {footer ? (
        <footer className="mt-5 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
