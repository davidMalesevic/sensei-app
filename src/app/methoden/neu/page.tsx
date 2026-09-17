import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { aktuellerBenutzer } from "@/lib/dal";
import { ladeBibliothek } from "@/lib/methoden";
import { MethodeForm } from "../methode-form";

export default async function MethodeNeuPage() {
  await aktuellerBenutzer();
  const bibliothek = await ladeBibliothek();
  if (!bibliothek) notFound();

  return (
    <>
      <PageHeader
        titel="Neue Methode"
        beschreibung="Eine eigene Methode. Sie gilt nur in deinem Konto und steht der Planung zur Verfügung, solange sie eingeschaltet ist."
        breadcrumb={[{ label: "Methoden", href: "/methoden" }, { label: "Neu" }]}
      />
      <MethodeForm
        kategorien={bibliothek.kategorien}
        sozialformen={bibliothek.sozialformen}
        schwerpunkte={bibliothek.schwerpunkte}
        abbrechenHref="/methoden"
      />
    </>
  );
}
