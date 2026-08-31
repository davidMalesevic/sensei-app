import Link from "next/link";
import { ArrowRight } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getImporte, getModuleFuerImport } from "./actions";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function ResultatePage() {
  const [module, importe] = await Promise.all([
    getModuleFuerImport(),
    getImporte(),
  ]);

  return (
    <>
      <PageHeader
        titel="Resultate"
        beschreibung="Abgaben aus Smartlearn einlesen und auswerten — Vollständigkeit, Auswahlaufgaben, auffällig gleiche Texte, Klassenbild."
      />

      <section className="mb-12">
        <SectionHeader titel="Export einlesen" />
        <ImportForm module={module} />
      </section>

      <section>
        <SectionHeader titel={`Importe (${importe.length})`} />
        {importe.length === 0 ? (
          <p className="type-body-02 bg-layer p-6 text-text-secondary">
            Noch nichts eingelesen.
          </p>
        ) : (
          <div className="bg-layer">
            {importe.map((i) => (
              <Link
                key={i.id}
                href={`/resultate/${i.id}`}
                className="type-body-compact-02 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3 transition-colors duration-[110ms] ease-carbon-standard last:border-b-0 hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <Badge variant="cool-gray" size="sm" className="shrink-0">
                  M{i.modulNummer}
                </Badge>
                <span className="w-32 shrink-0 font-semibold">
                  {i.klassenKuerzel ?? "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {i.durchfuehrung ?? i.dateiname}
                </span>
                <span className="text-text-secondary">
                  Export {i.exportDatum ?? "—"}
                </span>
                <span className="type-helper-02 text-text-helper">
                  eingelesen {new Date(i.createdAt).toLocaleDateString("de-CH")}
                </span>
                <ArrowRight size={16} className="shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
