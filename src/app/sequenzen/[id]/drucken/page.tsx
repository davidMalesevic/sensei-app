import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { getSequenzById } from "../../actions";
import { getAblauf } from "../../entwurf-actions";
import { getWochenstoff } from "@/lib/modulbaum";
import { getKWFromDateString } from "@/lib/kw";
import { PrintButton } from "./print-button";

const TYP_LABEL: Record<string, string> = {
  einstieg: "Einstieg",
  praxisbezug: "Praxisbezug",
  theorie: "Theorie",
  aufgabe: "Aufgabe",
  besprechung: "Besprechung",
  abschluss: "Abschluss",
  frei: "Frei",
};

function Feld({ label, wert }: { label: string; wert: string }) {
  return (
    <div>
      <div className="type-label-02 text-text-helper print:text-black">
        {label}
      </div>
      <div className="type-body-compact-02 mt-1">{wert}</div>
    </div>
  );
}

/** Druckfassung: der Ablauf, sonst nichts — eine Seite für den Unterricht. */
export default async function DruckenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seq = await getSequenzById(id);
  if (!seq) return notFound();

  const kw = getKWFromDateString(seq.startDatum);
  const [ablauf, stoff] = await Promise.all([
    getAblauf(id),
    seq.modulId && kw !== null
      ? getWochenstoff(seq.benutzerId, seq.modulId, kw)
      : null,
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-wrap gap-px print:hidden">
        <Button variant="secondary" render={<Link href={`/sequenzen/${id}`} />}>
          Zurück zur Sequenz
          <ArrowLeft size={16} />
        </Button>
        <PrintButton />
      </div>

      <header className="border-b-2 border-border-inverse pb-4 print:border-black">
        <h1 className="type-heading-04">{seq.titel}</h1>
        <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
          <Feld label="Klasse" wert={seq.klasse.bezeichnung} />
          {seq.startDatum && <Feld label="Datum" wert={seq.startDatum} />}
          {seq.startZeit && seq.endZeit && (
            <Feld label="Zeit" wert={`${seq.startZeit}–${seq.endZeit}`} />
          )}
          {seq.lektionen && (
            <Feld label="Lektionen" wert={String(seq.lektionen)} />
          )}
          {seq.raum && <Feld label="Raum" wert={seq.raum} />}
          {kw !== null && <Feld label="KW" wert={String(kw)} />}
        </div>
        {stoff?.lbHinweis && (
          <p className="type-heading-02 mt-4">
            Leistungsbeurteilung: {stoff.lbHinweis}
          </p>
        )}
      </header>

      {ablauf.length === 0 ? (
        <p className="type-body-02 mt-8 text-text-secondary">
          Für diese Sequenz ist noch kein Ablauf hinterlegt.
        </p>
      ) : (
        <ol className="mt-6">
          {ablauf.map((z, i) => (
            <li
              key={z.id}
              className="flex gap-4 break-inside-avoid border-b border-border-subtle py-3 last:border-b-0 print:border-neutral-300"
            >
              <span className="type-body-compact-02 w-6 shrink-0 text-right font-mono tabular-nums text-text-helper print:text-black">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="type-heading-compact-02">{z.titel}</span>
                  <span className="type-label-02 text-text-helper print:text-black">
                    {TYP_LABEL[z.typ] ?? z.typ}
                  </span>
                </div>
                {z.text && (
                  <p className="type-body-02 mt-1 text-text-secondary print:text-black">
                    {z.text}
                  </p>
                )}
                {z.refCode && (
                  <code className="type-helper-02 mt-1 block font-mono text-text-helper print:text-black">
                    {z.refCode}
                  </code>
                )}
              </div>
              {/* Platz zum Abhaken auf Papier */}
              <span className="mt-1 hidden size-4 shrink-0 border border-black print:block" />
            </li>
          ))}
        </ol>
      )}

      {seq.cockpitNotiz && (
        <section className="mt-8 break-inside-avoid border-t border-border-subtle pt-4 print:border-black">
          <h2 className="type-heading-02">Notizen</h2>
          <p className="type-body-02 mt-2 whitespace-pre-wrap">
            {seq.cockpitNotiz}
          </p>
        </section>
      )}
    </div>
  );
}
