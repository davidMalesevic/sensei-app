import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { getSequenzById } from "../../actions";
import { holePaket } from "../../einstieg-actions";
import { PrintButton } from "../drucken/print-button";
import { Beamer } from "./beamer";

/**
 * Der ausgearbeitete Einstieg zum Austeilen und Projizieren.
 *
 * Gedruckt wird nur, was im Zimmer gebraucht wird, und die Lösungen stehen
 * am Schluss auf einer eigenen Seite: ein Blatt, das man austeilt, darf die
 * Musterantworten nicht auf der Rückseite tragen.
 */
export default async function EinstiegPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [seq, paket] = await Promise.all([getSequenzById(id), holePaket(id)]);
  if (!seq) return notFound();

  if (!paket) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="type-body-02 mb-6 text-text-secondary">
          Für diese Lektion ist noch kein Einstieg ausgearbeitet.
        </p>
        <Button variant="secondary" render={<Link href={`/sequenzen/${id}`} />}>
          Zurück zur Sequenz
          <ArrowLeft size={16} />
        </Button>
      </div>
    );
  }

  const i = paket.inhalt;
  const fuerLernende = i.materialien.filter((m) => m.fuer !== "lehrperson");
  const fuerLehrperson = i.materialien.filter((m) => m.fuer === "lehrperson");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-wrap gap-px print:hidden">
        <Button variant="secondary" render={<Link href={`/sequenzen/${id}`} />}>
          Zurück zur Sequenz
          <ArrowLeft size={16} />
        </Button>
        <Beamer titel={i.titel} arbeitsauftrag={i.arbeitsauftrag} />
        <PrintButton />
      </div>

      <header className="mb-8">
        <h1 className="type-heading-04">{i.titel}</h1>
        <p className="type-body-02 mt-2 text-text-secondary print:text-black">
          {seq.klasse.bezeichnung} · {seq.titel}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="teal" size="sm">
            {paket.methodeName}
          </Badge>
          <span className="type-helper-02 text-text-helper print:text-black">
            {i.dauer_minuten} min · {i.sozialform}
          </span>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="type-heading-03 mb-2">Ablauf</h2>
        <ol className="grid gap-px bg-border-subtle print:gap-0 print:bg-transparent">
          {i.ablauf.map((s) => (
            <li key={s.schritt} className="bg-layer p-3 print:bg-transparent print:px-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="type-heading-compact-02">
                  {s.schritt}. {s.titel}
                </span>
                <span className="type-helper-02 text-text-helper print:text-black">
                  {s.sozialform} · {s.dauer_minuten} min
                </span>
              </div>
              <p className="type-body-compact-02 mt-1">
                <span className="text-text-helper print:text-black">Lehrperson: </span>
                {s.lehrperson}
              </p>
              <p className="type-body-compact-02">
                <span className="text-text-helper print:text-black">Lernende: </span>
                {s.lernende}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {i.vorbereitung.length > 0 && (
        <section className="mb-8">
          <h2 className="type-heading-03 mb-2">Vorbereitung</h2>
          <ul className="type-body-02 list-disc space-y-1 pl-5">
            {i.vorbereitung.map((v, n) => (
              <li key={n}>{v}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8 break-before-page">
        <h2 className="type-heading-03 mb-2">Arbeitsauftrag</h2>
        <Markdown
          text={i.arbeitsauftrag}
          className="bg-layer p-4 print:bg-transparent print:p-0"
        />
      </section>

      {fuerLernende.map((m) => (
        <section key={m.id} className="mb-8 break-before-page">
          <h2 className="type-heading-03 mb-1">{m.titel}</h2>
          {m.verwendung && (
            <p className="type-helper-02 mb-2 text-text-helper print:text-black">
              {m.verwendung}
            </p>
          )}
          <Markdown
            text={m.inhalt}
            className="bg-layer p-4 print:bg-transparent print:p-0"
          />
        </section>
      ))}

      {/* Alles ab hier ist für die Lehrperson — bewusst auf eigenen Seiten,
          damit es nicht versehentlich mit ausgeteilt wird. */}
      <section className="break-before-page">
        <h2 className="type-heading-03 mb-4 border-b border-border-strong pb-2">
          Nur für die Lehrperson
        </h2>

        <div className="mb-6">
          <h3 className="type-heading-compact-02">So läuft das hier</h3>
          <p className="type-body-02">{i.kurzerklaerung}</p>
        </div>
        <div className="mb-6">
          <h3 className="type-heading-compact-02">Ziel</h3>
          <p className="type-body-02">{i.ziel}</p>
        </div>

        {fuerLehrperson.map((m) => (
          <div key={m.id} className="mb-6">
            <h3 className="type-heading-compact-02">{m.titel}</h3>
            {m.verwendung && (
              <p className="type-helper-02 text-text-helper print:text-black">
                {m.verwendung}
              </p>
            )}
            <Markdown
              text={m.inhalt}
              className="mt-1 bg-layer p-4 print:bg-transparent print:p-0"
            />
          </div>
        ))}

        <div className="mb-6">
          <h3 className="type-heading-compact-02">Was zu erwarten ist</h3>
          <p className="type-body-02">{i.erwartungshorizont}</p>
        </div>
        <div className="mb-6">
          <h3 className="type-heading-compact-02">Differenzierung</h3>
          <p className="type-body-02">{i.differenzierung}</p>
        </div>
        <div className="mb-6">
          <h3 className="type-heading-compact-02">Anschluss</h3>
          <p className="type-body-02">{i.anschluss}</p>
        </div>
      </section>
    </div>
  );
}
