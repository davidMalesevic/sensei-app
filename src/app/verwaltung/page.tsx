import { PageHeader } from "@/components/ui/page-header";
import { aktuellerAdmin } from "@/lib/dal";
import { getKonten, getOffeneEinladungen, getVerwaltungZahlen } from "./actions";
import { KontenTabelle } from "./konten-tabelle";

export const dynamic = "force-dynamic";

/**
 * Verwaltung — nur für Admins. `aktuellerAdmin()` liefert für alle anderen
 * 404: eine Seite, die man nicht betreten darf, muss nicht verraten, dass es
 * sie gibt. Die Server Actions prüfen dasselbe noch einmal selbst.
 */
export default async function VerwaltungPage() {
  const admin = await aktuellerAdmin();
  const [konten, einladungen, zahlen] = await Promise.all([
    getKonten(),
    getOffeneEinladungen(),
    getVerwaltungZahlen(),
  ]);

  return (
    <>
      <PageHeader
        titel="Verwaltung"
        beschreibung={`${zahlen.konten} Konten · ${zahlen.sitzungen} offene Sitzungen · ${zahlen.einladungen} offene Einladungen`}
      />
      <KontenTabelle
        konten={konten}
        einladungen={einladungen}
        eigeneId={admin.id}
      />
    </>
  );
}
