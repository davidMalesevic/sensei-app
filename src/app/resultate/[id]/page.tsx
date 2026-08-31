import { notFound } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Notification } from "@/components/ui/notification";
import { PageHeader, SectionHeader, DataItem } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getAuswertung, getImporte } from "../actions";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const alle = await getImporte();
  const imp = alle.find((i) => i.id === id);
  if (!imp) return notFound();

  const { vollstaendigkeit, klassenbild, duplikate, geplant } =
    await getAuswertung(id);

  const lernende = vollstaendigkeit.length;
  const tagVon = new Map(geplant.map((g) => [g.aufgabeId, g.tage]));

  // Eine Aufgabe kann mehrere Abgabefelder haben (`Abgabe_8.1`, `Abgabe_8.2`).
  // Ohne Durchnummerierung stünden mehrere Zeilen mit identischer
  // Beschriftung untereinander.
  const teilVon = new Map<string, string>();
  const zaehler = new Map<string, number>();
  const proAufgabe = new Map<string, number>();
  for (const a of klassenbild) {
    const k = `${a.laCode}|${a.aufgabeNr}`;
    proAufgabe.set(k, (proAufgabe.get(k) ?? 0) + 1);
  }
  for (const a of klassenbild) {
    const k = `${a.laCode}|${a.aufgabeNr}`;
    if ((proAufgabe.get(k) ?? 0) < 2) continue;
    const n = (zaehler.get(k) ?? 0) + 1;
    zaehler.set(k, n);
    teilVon.set(a.aufgabeId, `Teil ${n}`);
  }
  const bezeichnung = (a: { aufgabeId: string; laCode: string | null; aufgabeNr: string | null }) =>
    `${a.laCode ?? "—"} · Aufgabe ${a.aufgabeNr ?? "—"}${teilVon.has(a.aufgabeId) ? ` · ${teilVon.get(a.aufgabeId)}` : ""}`;

  // Aufgaben, die niemand gelöst hat, sind meist schlicht noch nicht dran —
  // interessant ist, was angefangen, aber nicht von allen erledigt wurde.
  const angefangen = klassenbild.filter((a) => a.geloestVon > 0);
  const luecken = [...angefangen]
    .filter((a) => a.geloestVon < lernende)
    .sort((a, b) => a.geloestVon - b.geloestVon)
    .slice(0, 12);
  const auswahl = klassenbild.filter((a) => a.richtig !== null && a.geloestVon > 0);

  return (
    <>
      <PageHeader
        titel={imp.durchfuehrung ?? imp.dateiname ?? "Import"}
        beschreibung={`Momentaufnahme vom ${imp.exportDatum ?? "—"}`}
        breadcrumb={[{ label: "Resultate", href: "/resultate" }, { label: imp.klassenKuerzel ?? "Import" }]}
      >
        <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4 bg-layer p-4">
          <DataItem label="Modul">{imp.modulNummer}</DataItem>
          <DataItem label="Klasse">{imp.klassenKuerzel ?? "—"}</DataItem>
          <DataItem label="Lernende">{lernende}</DataItem>
          <DataItem label="Aufgaben">{klassenbild.length}</DataItem>
          <DataItem label="Davon angefangen">{angefangen.length}</DataItem>
        </div>
      </PageHeader>

      {/* ─ Wer hängt hinterher ─ */}
      <section className="mb-12">
        <SectionHeader
          titel="Vollständigkeit"
          beschreibung="Gezählt wird, was nach Abzug des vorbefüllten Textes übrig bleibt — ein Feld, in dem nur die Vorlage steht, gilt als offen."
        />
        <Table className="min-w-[40rem] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-layer-accent">
              <TableHead>Name</TableHead>
              <TableHead className="w-32">Gelöst</TableHead>
              <TableHead className="w-64">Anteil</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vollstaendigkeit.map((p) => {
              const anteil = Math.round((p.geloest / Math.max(1, p.gesamt)) * 100);
              return (
                <TableRow key={p.personId}>
                  <TableCell className="truncate font-semibold">{p.name}</TableCell>
                  <TableCell className="tabular-nums text-text-secondary">
                    {p.geloest} / {p.gesamt}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 bg-layer-accent">
                        <div
                          className="h-2 bg-primary"
                          style={{ width: `${anteil}%` }}
                        />
                      </div>
                      <span className="type-helper-02 tabular-nums text-text-helper">
                        {anteil}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {/* ─ Klassenbild ─ */}
      <section className="mb-12">
        <SectionHeader
          titel="Wo die Klasse hängt"
          beschreibung="Aufgaben, die angefangen, aber nicht von allen gelöst wurden. Aufgaben, die niemand angefasst hat, stehen nicht hier — die sind meist schlicht noch nicht dran."
        />
        {luecken.length === 0 ? (
          <p className="type-body-02 bg-layer p-6 text-text-secondary">
            Alle angefangenen Aufgaben sind von allen gelöst.
          </p>
        ) : (
          <div className="bg-layer">
            {luecken.map((a) => {
              const tage = tagVon.get(a.aufgabeId) ?? [];
              return (
                <div
                  key={a.aufgabeId}
                  className="border-b border-border-subtle px-4 py-3 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      variant={a.geloestVon < lernende / 2 ? "red" : "cool-gray"}
                      size="sm"
                    >
                      {a.geloestVon} / {lernende}
                    </Badge>
                    <code className="type-helper-02 font-mono text-text-helper">
                      {bezeichnung(a)}
                    </code>
                    {tage.map((t, i) => (
                      <Link
                        key={i}
                        href={`/sequenzen/${t.sequenzId}`}
                        className="type-helper-02 text-link underline-offset-2 hover:underline"
                      >
                        geplant {t.datum?.toString().slice(0, 10)} · {t.klasse}
                      </Link>
                    ))}
                  </div>
                  <p className="type-body-01 mt-2 text-text-secondary">
                    {a.frage.replace(/\s+/g, " ").slice(0, 220)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─ Auswahlaufgaben ─ */}
      {auswahl.length > 0 && (
        <section className="mb-12">
          <SectionHeader
            titel="Auswahlaufgaben"
            beschreibung="Gegen die Musterlösung verglichen — rein rechnerisch, ohne KI."
          />
          <div className="bg-layer">
            {auswahl
              .sort((a, b) => (a.richtig ?? 0) - (b.richtig ?? 0))
              .slice(0, 12)
              .map((a) => (
                <div
                  key={a.aufgabeId}
                  className="type-body-compact-02 flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-2 last:border-b-0"
                >
                  <Badge
                    variant={(a.richtig ?? 0) < a.geloestVon / 2 ? "red" : "green"}
                    size="sm"
                  >
                    {a.richtig} von {a.geloestVon} richtig
                  </Badge>
                  <code className="type-helper-02 font-mono text-text-helper">
                    {bezeichnung(a)}
                  </code>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ─ Gleiche Texte ─ */}
      <section className="mb-12">
        <SectionHeader
          titel="Auffällig gleiche Texte"
          beschreibung="Gruppen mit demselben Text. Das ist Material für ein Gespräch, kein Urteil."
        />

        {duplikate.auffaellig.length === 0 ? (
          <p className="type-body-02 bg-layer p-6 text-text-secondary">
            Nichts Auffälliges.
          </p>
        ) : (
          <div className="bg-layer">
            {duplikate.auffaellig.map((g, i) => (
              <div key={i} className="border-b border-border-subtle px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="purple" size="sm">
                    {g.namen.length} Personen
                  </Badge>
                  <span className="type-body-compact-02 font-semibold">
                    {g.namen.join(", ")}
                  </span>
                  <code className="type-helper-02 font-mono text-text-helper">
                    {g.laCode ?? "—"} · Aufgabe {g.aufgabeNr ?? "—"}
                  </code>
                </div>
                <p className="type-body-01 mt-2 whitespace-pre-wrap text-foreground">
                  {g.text.slice(0, 400)}
                </p>
              </div>
            ))}
          </div>
        )}

        {duplikate.vorgegeben.length > 0 && (
          <Notification kind="info" titel="Als vorgegeben eingestuft" className="mt-4">
            {duplikate.vorgegeben.length} weitere Textgruppen umfassen mehr als
            40% der Klasse. Das ist fast immer vorgegebener Text — eine
            Definition im Auftrag oder eine Tabellenvorlage — und wird deshalb
            nicht als Abschreiben gemeldet.
          </Notification>
        )}
      </section>
    </>
  );
}
