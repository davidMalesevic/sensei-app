import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/**
 * Modularbeitsplan für Modul 219.
 *
 * Der Smartlearn-Export dieses Moduls enthält den «Modulablauf» nur als
 * **Bild**, nicht als Tabelle — deshalb kann ihn kein Parser lesen. Die Daten
 * hier sind von Hand aus dieser Grafik übertragen.
 *
 * Der Ablauf ist nach Unterrichtsdaten (Freitage) organisiert, je zwei
 * Lektionen. Umgerechnet wird auf ISO-Kalenderwochen, weil die Kette
 * KW + Modul ⇒ Block ⇒ LA ⇒ Aufgaben darauf aufsetzt.
 *
 * Läuft der Import über die Datei erneut, bleibt dieser Plan bestehen:
 * `importModularPlan` bricht bei null erkannten Einträgen ab, bevor gelöscht
 * wird.
 */
type Eintrag = {
  datum: string;
  lektion1: string;
  lektion2: string;
  bloecke: string[];
  lb: string | null;
};

const ABLAUF: Eintrag[] = [
  { datum: "2026-08-14", lektion1: "Block 0", lektion2: "Block 0", bloecke: ["0"], lb: null },
  { datum: "2026-08-21", lektion1: "Block 1", lektion2: "Block 1", bloecke: ["1"], lb: null },
  { datum: "2026-08-28", lektion1: "Block 1", lektion2: "Block 1", bloecke: ["1"], lb: null },
  { datum: "2026-09-04", lektion1: "Übergabe Vertiefungsarbeit", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: [], lb: "Übergabe Vertiefungsarbeit" },
  { datum: "2026-09-11", lektion1: "Block 2", lektion2: "Block 2", bloecke: ["2"], lb: null },
  { datum: "2026-09-18", lektion1: "Block 2", lektion2: "Block 2", bloecke: ["2"], lb: null },
  { datum: "2026-10-16", lektion1: "Block 3", lektion2: "Block 3", bloecke: ["3"], lb: null },
  { datum: "2026-10-23", lektion1: "Freie Arbeitszeit Vertiefungsarbeit", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: [], lb: null },
  { datum: "2026-10-30", lektion1: "Transferbericht", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: [], lb: "Transferbericht" },
  { datum: "2026-11-06", lektion1: "Freie Arbeitszeit Vertiefungsarbeit", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: [], lb: "Zwischenabgabe Vertiefungsarbeit" },
  { datum: "2026-11-13", lektion1: "Block 4", lektion2: "Block 4", bloecke: ["4"], lb: null },
  { datum: "2026-11-20", lektion1: "Freie Arbeitszeit Vertiefungsarbeit", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: [], lb: null },
  { datum: "2026-11-27", lektion1: "Block 5", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: ["5"], lb: null },
  { datum: "2026-12-04", lektion1: "Block 5", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: ["5"], lb: null },
  { datum: "2026-12-11", lektion1: "Freie Arbeitszeit Vertiefungsarbeit", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: [], lb: null },
  { datum: "2026-12-18", lektion1: "Freie Arbeitszeit Vertiefungsarbeit", lektion2: "Freie Arbeitszeit Vertiefungsarbeit", bloecke: [], lb: null },
  { datum: "2027-01-15", lektion1: "Freie Arbeitszeit Vertiefungsarbeit", lektion2: "Präsentation & Abgabe Vertiefungsarbeit", bloecke: [], lb: "Präsentation & Abgabe Vertiefungsarbeit" },
  { datum: "2027-01-22", lektion1: "Präsentation Vertiefungsarbeit", lektion2: "Block 5 & Modulabschluss", bloecke: ["5"], lb: "Präsentation Vertiefungsarbeit" },
];

/** ISO-8601-Kalenderwoche. */
function isoKW(datum: string): number {
  const d = new Date(datum + "T00:00:00Z");
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tag);
  const jahresStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - jahresStart.getTime()) / 86400000 + 1) / 7);
}

const client = postgres(process.env.DATABASE_URL!);

async function seed() {
  const [modul] = await client`SELECT id FROM modul WHERE nummer = 219`;
  if (!modul) throw new Error("Modul 219 existiert nicht.");

  await client`DELETE FROM modular_plan WHERE modul_id = ${modul.id}`;

  for (const e of ABLAUF) {
    const kw = isoKW(e.datum);
    const ziel =
      e.lektion1 === e.lektion2 ? e.lektion1 : `${e.lektion1} · ${e.lektion2}`;

    await client`
      INSERT INTO modular_plan (modul_id, kw, ziel, beschreibung, lb_hinweis, bloecke)
      VALUES (
        ${modul.id}, ${kw}, ${ziel.slice(0, 300)},
        ${`Unterricht am ${e.datum}`}, ${e.lb},
        ${e.bloecke.length > 0 ? e.bloecke : null}
      )
    `;
    console.log(`  KW ${kw}  ${ziel}${e.lb ? `   [LB: ${e.lb}]` : ""}`);
  }

  console.log(`\n${ABLAUF.length} Wochen für Modul 219 gesetzt.`);
  await client.end();
}

seed().catch((err) => {
  console.error("Seed-Fehler:", err);
  process.exit(1);
});
