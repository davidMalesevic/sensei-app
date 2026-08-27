import { KlasseForm } from "../klasse-form";
import { createKlasse } from "../actions";
import { PageHeader } from "@/components/ui/page-header";

export default function NeueKlassePage() {
  return (
    <>
      <PageHeader
        titel="Neue Klasse"
        breadcrumb={[{ label: "Klassen", href: "/klassen" }, { label: "Neu" }]}
      />
      <KlasseForm action={createKlasse} />
    </>
  );
}
