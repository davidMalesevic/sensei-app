import { notFound } from "next/navigation";
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
    seq.modulId && kw !== null ? getWochenstoff(seq.modulId, kw) : null,
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 print:space-y-4">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold">{seq.titel}</h1>
        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-3">
          <span>{seq.klasse.bezeichnung}</span>
          {seq.startDatum && <span>{seq.startDatum}</span>}
          {seq.startZeit && seq.endZeit && (
            <span>
              {seq.startZeit}–{seq.endZeit}
            </span>
          )}
          {seq.lektionen && <span>{seq.lektionen} Lektionen</span>}
          {seq.raum && <span>{seq.raum}</span>}
          {kw !== null && <span>KW {kw}</span>}
        </div>
        {stoff?.lbHinweis && (
          <p className="text-sm mt-2 font-medium">
            Leistungsbeurteilung: {stoff.lbHinweis}
          </p>
        )}
      </header>

      {ablauf.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Für diese Sequenz ist noch kein Ablauf hinterlegt.
        </p>
      ) : (
        <ol className="space-y-3">
          {ablauf.map((z, i) => (
            <li key={z.id} className="flex gap-3 break-inside-avoid">
              <span className="text-sm text-muted-foreground tabular-nums w-5 shrink-0">
                {i + 1}.
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {z.titel}
                  <span className="ml-2 text-xs font-normal text-muted-foreground uppercase">
                    {TYP_LABEL[z.typ] ?? z.typ}
                  </span>
                </p>
                {z.text && (
                  <p className="text-sm text-muted-foreground">{z.text}</p>
                )}
                {z.refCode && (
                  <p className="text-xs text-muted-foreground">{z.refCode}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {seq.cockpitNotiz && (
        <section className="border-t pt-4">
          <h2 className="text-sm font-semibold mb-1">Notizen</h2>
          <p className="text-sm whitespace-pre-wrap">{seq.cockpitNotiz}</p>
        </section>
      )}
    </div>
  );
}
