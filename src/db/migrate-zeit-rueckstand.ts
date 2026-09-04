/**
 * Rückstand und Zeitbudget.
 *
 * Zwei zusammenhängende Erweiterungen:
 *
 * 1. **Zeit** — Minuten an Aufgabe, Auftrag, Block und Ablaufschritt. Im
 *    Smartlearn-Export steht keine Zeitangabe, eine Dauer kann deshalb nie
 *    ein Fakt sein: `dauer_quelle` hält fest, ob die KI geschätzt oder die
 *    Lehrperson korrigiert hat. Der Schätzlauf fasst `person` nie an.
 * 2. **Rückstand** — `sequenz_ablauf.rueckstand_kw` merkt sich, aus welcher
 *    Woche ein Fakt stammt. Nur zur Anzeige; die Rechnung läuft jedes Mal neu
 *    über Modulplan und Überträge.
 *
 * Idempotent: `ADD COLUMN IF NOT EXISTS`, Enum mit `duplicate_object`-Fang.
 * `npx drizzle-kit push` geht hier nicht — es verlangt einen interaktiven TTY.
 */

import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Erzeuge Enum dauer_quelle ...");
  await client`
    DO $$ BEGIN
      CREATE TYPE dauer_quelle AS ENUM ('ki', 'person');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // Die Vorgabe hängt an der Aufgabe, nicht an der Lektion: «Aufgabe 3 dauert
  // 40 Minuten» gilt für alle Klassen und alle künftigen Durchgänge.
  console.log("Zeitspalten an modul_aufgabe ...");
  await client`ALTER TABLE modul_aufgabe ADD COLUMN IF NOT EXISTS dauer_minuten INTEGER`;
  await client`ALTER TABLE modul_aufgabe ADD COLUMN IF NOT EXISTS dauer_quelle dauer_quelle`;

  // Manche Module nummerieren ihre Aufgaben nicht — dort ist der LA selbst die
  // Einheit, die geplant wird, und braucht deshalb eine eigene Dauer.
  console.log("Zeitspalten an modul_auftrag ...");
  await client`ALTER TABLE modul_auftrag ADD COLUMN IF NOT EXISTS dauer_minuten INTEGER`;
  await client`ALTER TABLE modul_auftrag ADD COLUMN IF NOT EXISTS dauer_quelle dauer_quelle`;

  // Für den Theorie-Fakt, der aus dem Slidebereich des Blocks entsteht.
  console.log("Zeitspalten an modul_block ...");
  await client`ALTER TABLE modul_block ADD COLUMN IF NOT EXISTS dauer_minuten INTEGER`;
  await client`ALTER TABLE modul_block ADD COLUMN IF NOT EXISTS dauer_quelle dauer_quelle`;

  console.log("Zeit- und Rückstandsspalten an sequenz_ablauf ...");
  await client`ALTER TABLE sequenz_ablauf ADD COLUMN IF NOT EXISTS dauer_minuten INTEGER`;
  await client`ALTER TABLE sequenz_ablauf ADD COLUMN IF NOT EXISTS dauer_quelle dauer_quelle`;
  await client`ALTER TABLE sequenz_ablauf ADD COLUMN IF NOT EXISTS rueckstand_kw INTEGER`;

  // Der Rückstand liest alle Vorsequenzen derselben Klasse im selben Modul.
  // Ohne Index ist das pro Sequenzseite ein Full Scan über `sequenz`.
  console.log("Index für die Rückstandsabfrage ...");
  await client`
    CREATE INDEX IF NOT EXISTS sequenz_klasse_modul_datum_idx
      ON sequenz (benutzer_id, klasse_id, modul_id, start_datum)
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
