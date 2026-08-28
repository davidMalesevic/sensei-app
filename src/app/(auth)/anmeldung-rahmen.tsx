import Link from "next/link";

/**
 * Rahmen für Anmelden und Registrieren.
 *
 * Carbon setzt Anmeldeseiten als ruhige, linksbündige Spalte auf leerem
 * Grund — kein zentrierter Kasten mit Schatten. Die Marke steht oben in der
 * schwarzen Leiste, damit die Seite zur UI Shell dahinter passt.
 */
export function AnmeldungRahmen({
  titel,
  untertitel,
  children,
  fussnote,
}: {
  titel: string;
  untertitel?: string;
  children: React.ReactNode;
  fussnote?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-12 items-center border-b border-shell-border bg-shell px-4">
        <Link
          href="/anmelden"
          className="flex items-center gap-2 text-shell-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
        >
          <span className="type-body-compact-02 font-semibold">Sensei</span>
          <span className="type-body-compact-02 text-shell-text-secondary">
            Unterrichtsplanung
          </span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-16 md:py-24">
        <h1 className="type-heading-04 text-foreground">{titel}</h1>
        {untertitel && (
          <p className="type-body-02 mt-2 text-text-secondary">{untertitel}</p>
        )}

        <div className="mt-10">{children}</div>

        {fussnote && (
          <div className="type-body-02 mt-10 border-t border-border-subtle pt-6 text-text-secondary">
            {fussnote}
          </div>
        )}
      </main>
    </div>
  );
}
