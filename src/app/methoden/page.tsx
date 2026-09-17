import Link from "next/link";
import { Add } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { aktuellerBenutzer } from "@/lib/dal";
import { ladeBibliothek, wirksameMethoden } from "@/lib/methoden";
import { BibliothekEinlesen } from "./bibliothek-einlesen";
import { MethodenListe } from "./methoden-liste";

export default async function MethodenPage() {
  const ich = await aktuellerBenutzer();
  const [bibliothek, methoden] = await Promise.all([
    ladeBibliothek(),
    wirksameMethoden(ich.id),
  ]);

  return (
    <>
      <PageHeader
        titel="Methoden"
        beschreibung="Methoden zur Aktivierung des Vorwissens. Die Planung wählt den Einstieg aus den eingeschalteten; was du anpasst, gilt nur für dein Konto."
        aktionen={
          bibliothek && (
            <Button render={<Link href="/methoden/neu" />}>
              Neue Methode
              <Add size={16} />
            </Button>
          )
        }
      />

      {!bibliothek ? (
        <div className="bg-layer p-8">
          <p className="type-body-02 max-w-2xl text-text-secondary">
            Die Methodenbibliothek ist noch nicht eingelesen.
            {!ich.istAdmin && " Das erledigt ein Admin."}
          </p>
          {ich.istAdmin && <BibliothekEinlesen className="mt-6" />}
        </div>
      ) : (
        <>
          <MethodenListe
            methoden={methoden.map((m) => ({
              id: m.id,
              schluessel: m.schluessel,
              name: m.name,
              kategorie: m.kategorie,
              sozialform: m.sozialform,
              dauerMin: m.dauerMin,
              dauerMax: m.dauerMax,
              schwerpunkt: m.schwerpunkt,
              kurzbeschreibung: m.kurzbeschreibung,
              herkunft: m.herkunft,
              ausgeschaltet: m.ausgeschaltet,
              mitDaten: m.datenJsonSchema !== null,
            }))}
            kategorien={bibliothek.kategorien}
            sozialformen={bibliothek.sozialformen}
            schwerpunkte={bibliothek.schwerpunkte}
          />
          {ich.istAdmin && (
            <details className="mt-12 max-w-2xl">
              <summary className="type-heading-compact-02 cursor-pointer py-2">
                Bibliothek neu einlesen
              </summary>
              <p className="type-helper-02 mb-4 text-text-helper">
                Zuletzt eingelesen am{" "}
                {bibliothek.eingelesenAm.toLocaleString("de-CH", {
                  timeZone: "Europe/Zurich",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · Version {bibliothek.schemaVersion}
              </p>
              <BibliothekEinlesen />
            </details>
          )}
        </>
      )}
    </>
  );
}
