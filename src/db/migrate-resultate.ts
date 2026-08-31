/**
 * Smartlearn-Resultate: vier eigene Tabellen, kein Eingriff in bestehende.
 *
 *   npx tsx src/db/migrate-resultate.ts
 *
 * Rückgängig: `npx tsx src/db/drop-resultate.ts` — das Feature ist als
 * Versuch angelegt und soll sich spurlos entfernen lassen.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt — liegt .env.local am richtigen Ort?");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  console.log("→ resultat_import");
  await sql`
    CREATE TABLE IF NOT EXISTS resultat_import (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      benutzer_id uuid NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
      modul_id uuid NOT NULL REFERENCES modul(id) ON DELETE CASCADE,
      klasse_id uuid REFERENCES klasse(id) ON DELETE SET NULL,
      durchfuehrung varchar(200),
      klassen_kuerzel varchar(100),
      export_datum varchar(20),
      dateiname varchar(300),
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS resultat_import_modul_idx ON resultat_import (modul_id)`;
  await sql`CREATE INDEX IF NOT EXISTS resultat_import_benutzer_idx ON resultat_import (benutzer_id)`;

  console.log("→ resultat_person");
  await sql`
    CREATE TABLE IF NOT EXISTS resultat_person (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      import_id uuid NOT NULL REFERENCES resultat_import(id) ON DELETE CASCADE,
      nachname varchar(200) NOT NULL,
      vorname varchar(200) NOT NULL,
      email varchar(320) NOT NULL,
      ist_lehrperson boolean NOT NULL DEFAULT false
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS resultat_person_import_idx ON resultat_person (import_id)`;

  console.log("→ resultat_aufgabe");
  await sql`
    CREATE TABLE IF NOT EXISTS resultat_aufgabe (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      import_id uuid NOT NULL REFERENCES resultat_import(id) ON DELETE CASCADE,
      spalte varchar(10) NOT NULL,
      la_code varchar(300),
      aufgabe_nr varchar(50),
      art varchar(50) NOT NULL,
      frage text,
      musterloesung text,
      UNIQUE (import_id, spalte)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS resultat_aufgabe_la_idx ON resultat_aufgabe (la_code)`;

  console.log("→ resultat_abgabe");
  await sql`
    CREATE TABLE IF NOT EXISTS resultat_abgabe (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      person_id uuid NOT NULL REFERENCES resultat_person(id) ON DELETE CASCADE,
      aufgabe_id uuid NOT NULL REFERENCES resultat_aufgabe(id) ON DELETE CASCADE,
      text text NOT NULL,
      text_bereinigt text NOT NULL,
      UNIQUE (person_id, aufgabe_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS resultat_abgabe_aufgabe_idx ON resultat_abgabe (aufgabe_id)`;

  console.log("\nFertig. Rückgängig mit: npx tsx src/db/drop-resultate.ts");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
