import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { aktuellerBenutzer } from "@/lib/dal";
import { ladeBibliothek, ladeMethode } from "@/lib/methoden";
import { MethodeForm } from "../../methode-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MethodeBearbeitenPage({
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

  // Eine geteilte Methode wird beim Speichern zur eigenen Fassung — ausser
  // ein Admin entscheidet sich ausdrücklich für «für alle».
  const geteilt = m.herkunft === "geteilt";

  return (
    <>
      <PageHeader
        titel={m.name}
        beschreibung={geteilt ? "Geteilte Methode anpassen" : "Methode bearbeiten"}
        breadcrumb={[
          { label: "Methoden", href: "/methoden" },
          { label: m.name, href: `/methoden/${m.id}` },
          { label: "Bearbeiten" },
        ]}
      />
      <MethodeForm
        werte={{
          id: m.id,
          name: m.name,
          kategorie: m.kategorie,
          sozialform: m.sozialform,
          dauerMin: m.dauerMin,
          dauerMax: m.dauerMax,
          dauerStandard: m.dauerStandard,
          schwerpunkt: m.schwerpunkt,
          kurzbeschreibung: m.kurzbeschreibung,
          material: m.material,
          parameter: m.parameter,
          anweisung: m.anweisung,
        }}
        kategorien={bibliothek.kategorien}
        sozialformen={bibliothek.sozialformen}
        schwerpunkte={bibliothek.schwerpunkte}
        darfGeteilt={geteilt && ich.istAdmin}
        alsFassungVon={geteilt ? m.name : undefined}
        abbrechenHref={`/methoden/${m.id}`}
      />
    </>
  );
}
