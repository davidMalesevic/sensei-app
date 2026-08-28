import { Badge } from "@/components/ui/badge";
import { PageHeader, DataItem } from "@/components/ui/page-header";
import { getMeinKonto } from "./actions";
import { ProfilFormular, PasswortFormular, VorbereitungFormular } from "./formulare";

export const dynamic = "force-dynamic";

export default async function MeinKontoPage() {
  const k = await getMeinKonto();

  return (
    <>
      <PageHeader
        titel="Mein Konto"
        aktionen={k.istAdmin ? <Badge variant="blue">Admin</Badge> : undefined}
      >
        <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4 bg-layer p-4">
          <DataItem label="Angemeldet als">{k.email}</DataItem>
          <DataItem label="Konto seit">
            {new Date(k.createdAt).toLocaleDateString("de-CH")}
          </DataItem>
        </div>
      </PageHeader>

      <ProfilFormular name={k.name} email={k.email} />
      <VorbereitungFormular
        aktiv={k.vorbereitungAktiv}
        tag={k.vorbereitungTag}
        stunde={k.vorbereitungStunde}
        tageVoraus={k.vorbereitungTageVoraus}
      />
      <PasswortFormular />
    </>
  );
}
