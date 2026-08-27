import { notFound } from "next/navigation";

import { KlasseForm } from "../../klasse-form";
import { getKlasseById, updateKlasse } from "../../actions";
import { PageHeader } from "@/components/ui/page-header";

export default async function KlasseBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kl = await getKlasseById(id);

  if (!kl) return notFound();

  const updateAction = updateKlasse.bind(null, id);

  return (
    <>
      <PageHeader
        titel={kl.bezeichnung}
        beschreibung="Klasse bearbeiten"
        breadcrumb={[
          { label: "Klassen", href: "/klassen" },
          { label: kl.bezeichnung },
        ]}
      />
      <KlasseForm
        klasse={{
          id: kl.id,
          bezeichnung: kl.bezeichnung,
          beruf: kl.beruf,
          lehrjahr: kl.lehrjahr,
        }}
        action={updateAction}
      />
    </>
  );
}
