import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit } from "@carbon/icons-react";

import { DeleteButton } from "@/components/delete-button";
import { Button } from "@/components/ui/button";
import { Notification } from "@/components/ui/notification";
import {
  DataItem,
  PageHeader,
  SectionHeader,
} from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { aktuellerBenutzer } from "@/lib/dal";
import { ladeBibliothek, ladeMethode } from "@/lib/methoden";
import { parameterWerte, rendereVorlage } from "@/lib/methoden-vorlage";
import { fassungVerwerfen, methodeLoeschen } from "../actions";
import { HerkunftTag, SchwerpunktTag, SozialformTags } from "../anzeige";
import { MethodeSchalter } from "../methode-schalter";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MethodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const ich = await aktuellerBenutzer();
  const [m, bibliothek] = await Promise.all([
    ladeMethode(ich.id, id),
    ladeBibliothek(),
  ]);
  if (!m || !bibliothek) notFound();

  const kategorie =
    bibliothek.kategorien.find((k) => k.id === m.kategorie)?.name ??
    m.kategorie;
  const vorschau = rendereVorlage(m.anweisung, parameterWerte(m.parameter));
  const darfLoeschen =
    m.herkunft === "eigene" || (m.herkunft === "geteilt" && ich.istAdmin);

  // Wer eine geteilte Methode anpasst, bearbeitet in Wahrheit die eigene
  // Fassung — gibt es sie schon, führt der Knopf direkt dorthin.
  const bearbeitenId = m.eigeneFassungId ?? m.id;
  const bearbeitenLabel =
    m.herkunft === "geteilt" && !m.eigeneFassungId && !ich.istAdmin
      ? "Anpassen"
      : "Bearbeiten";

  return (
    <>
      <PageHeader
        titel={m.name}
        breadcrumb={[{ label: "Methoden", href: "/methoden" }, { label: m.name }]}
        aktionen={
          <>
            {m.herkunft === "fassung" && (
              <DeleteButton
                mitText
                label="Fassung verwerfen"
                titel="Eigene Fassung verwerfen?"
                beschreibung={`Deine Änderungen an «${m.name}» gehen verloren. Danach gilt wieder die geteilte Fassung.`}
                onDelete={fassungVerwerfen.bind(null, m.id)}
              />
            )}
            {darfLoeschen && (
              <DeleteButton
                mitText
                titel="Methode löschen?"
                beschreibung={
                  m.herkunft === "geteilt"
                    ? `«${m.name}» verschwindet für alle Konten. Eigene Fassungen anderer bleiben als deren eigene Methode bestehen. Ein erneutes Einlesen der Bibliothek holt die Methode zurück.`
                    : `«${m.name}» wird endgültig gelöscht.`
                }
                onDelete={methodeLoeschen.bind(null, m.id)}
              />
            )}
            <Button render={<Link href={`/methoden/${bearbeitenId}/bearbeiten`} />}>
              {bearbeitenLabel}
              <Edit size={16} />
            </Button>
          </>
        }
      />

      {m.eigeneFassungId && (
        <Notification
          kind="info"
          titel="Du hast eine eigene Fassung."
          className="mb-8"
          action={
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={`/methoden/${m.eigeneFassungId}`} />}
            >
              Zur eigenen Fassung
            </Button>
          }
        >
          In deiner Planung gilt sie, nicht die geteilte hier.
        </Notification>
      )}
      {m.herkunft === "fassung" && m.basisId && (
        <Notification
          kind="info"
          titel="Eigene Fassung einer geteilten Methode."
          className="mb-8"
          action={
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={`/methoden/${m.basisId}`} />}
            >
              Geteilte ansehen
            </Button>
          }
        >
          Sie gilt nur in deinem Konto.
        </Notification>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <MethodeSchalter
          schluessel={m.schluessel}
          name={m.name}
          an={!m.ausgeschaltet}
          mitText
        />
        <HerkunftTag herkunft={m.herkunft} />
      </div>

      <p className="type-body-02 mb-8 max-w-3xl">{m.kurzbeschreibung}</p>

      <div className="mb-12 grid gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
        <DataItem label="Kategorie" className="bg-layer p-4">
          {kategorie}
        </DataItem>
        <DataItem label="Sozialform" className="bg-layer p-4">
          <SozialformTags sozialform={m.sozialform} namen={bibliothek.sozialformen} />
          <span className="type-helper-02 mt-1 block text-text-helper">
            {m.sozialform.map((s) => bibliothek.sozialformen[s] ?? s).join(" / ")}
          </span>
        </DataItem>
        <DataItem label="Dauer" className="bg-layer p-4">
          {m.dauerMin}–{m.dauerMax} min
          <span className="type-helper-02 mt-1 block text-text-helper">
            Standard {m.dauerStandard} min
          </span>
        </DataItem>
        <DataItem label="Schwerpunkt" className="bg-layer p-4">
          <SchwerpunktTag schwerpunkt={m.schwerpunkt} />
          <span className="type-helper-02 mt-1 block text-text-helper">
            {bibliothek.schwerpunkte[m.schwerpunkt]}
          </span>
        </DataItem>
      </div>

      <section className="mb-12 max-w-3xl">
        <SectionHeader titel="Material" beschreibung="Was die Ausarbeitung liefert." />
        {m.material.length === 0 ? (
          <p className="type-body-02 text-text-secondary">Keine Angabe.</p>
        ) : (
          <ul className="type-body-02 list-disc space-y-1 pl-6">
            {m.material.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        {m.datenJsonSchema !== null && (
          <p className="type-helper-02 mt-4 text-text-helper">
            Liefert zusätzlich strukturierte Daten, aus denen Sensei eine Grafik
            oder Karten zeichnet.
          </p>
        )}
      </section>

      <section className="mb-12 max-w-3xl">
        <SectionHeader
          titel="Parameter"
          beschreibung="Einstellbare Mengen. Beim Ausarbeiten gilt die Vorgabe, sofern nichts anderes gewählt wird."
        />
        {m.parameter.length === 0 ? (
          <p className="type-body-02 text-text-secondary">Keine.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-layer-accent">
                <TableHead>Name</TableHead>
                <TableHead>Bedeutung</TableHead>
                <TableHead className="w-24 text-right">Vorgabe</TableHead>
                <TableHead className="w-28 text-right">Bereich</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.parameter.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-mono">{p.name}</TableCell>
                  <TableCell className="text-text-secondary">{p.beschreibung}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.default}</TableCell>
                  <TableCell className="text-right text-text-secondary tabular-nums">
                    {p.min}–{p.max}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="mb-12 max-w-3xl">
        <SectionHeader
          titel="Anweisung an die KI"
          beschreibung="Der methodenspezifische Auftrag, mit den Vorgaben eingesetzt."
        />
        <p className="type-body-02 whitespace-pre-wrap bg-layer p-4">{vorschau}</p>
        {vorschau !== m.anweisung && (
          <details className="mt-4">
            <summary className="type-label-02 cursor-pointer text-text-secondary">
              Vorlage mit Platzhaltern
            </summary>
            <pre className="type-body-compact-01 mt-2 whitespace-pre-wrap bg-layer p-4 font-mono">
              {m.anweisung}
            </pre>
          </details>
        )}
      </section>
    </>
  );
}
