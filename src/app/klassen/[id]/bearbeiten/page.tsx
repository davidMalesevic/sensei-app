import { notFound } from "next/navigation";
import { KlasseForm } from "../../klasse-form";
import { getKlasseById, updateKlasse } from "../../actions";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Klasse bearbeiten
        </h1>
        <p className="text-muted-foreground mt-1">{kl.bezeichnung}</p>
      </div>
      <KlasseForm
        klasse={{
          id: kl.id,
          bezeichnung: kl.bezeichnung,
          beruf: kl.beruf,
          lehrjahr: kl.lehrjahr,
        }}
        action={updateAction}
      />
    </div>
  );
}
