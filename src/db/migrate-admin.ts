/**
 * Verwaltung: Admin-Flag, letzte Anmeldung, Einmal-Links fürs Passwort.
 *
 *   npx tsx src/db/migrate-admin.ts
 *
 * Idempotent. Macht ausserdem das **älteste Konto** zum Admin, falls es noch
 * gar keinen gibt — sonst käme nach der Migration niemand in die Verwaltung.
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
  console.log("→ benutzer.ist_admin");
  await sql`
    ALTER TABLE benutzer
    ADD COLUMN IF NOT EXISTS ist_admin boolean NOT NULL DEFAULT false
  `;

  console.log("→ benutzer.letzte_anmeldung");
  await sql`ALTER TABLE benutzer ADD COLUMN IF NOT EXISTS letzte_anmeldung timestamp`;

  console.log("→ Vorbereitungsdurchgang pro Konto");
  await sql`ALTER TABLE benutzer ADD COLUMN IF NOT EXISTS vorbereitung_aktiv boolean NOT NULL DEFAULT true`;
  await sql`ALTER TABLE benutzer ADD COLUMN IF NOT EXISTS vorbereitung_tag integer`;
  await sql`ALTER TABLE benutzer ADD COLUMN IF NOT EXISTS vorbereitung_stunde integer NOT NULL DEFAULT 3`;
  await sql`ALTER TABLE benutzer ADD COLUMN IF NOT EXISTS vorbereitung_tage_voraus integer NOT NULL DEFAULT 10`;

  console.log("→ Tabelle passwort_reset");
  await sql`
    CREATE TABLE IF NOT EXISTS passwort_reset (
      token_hash text PRIMARY KEY,
      benutzer_id uuid NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp NOT NULL,
      verwendet_am timestamp
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS passwort_reset_benutzer_idx
      ON passwort_reset (benutzer_id)
  `;

  console.log("→ Tabelle einladung");
  await sql`
    CREATE TABLE IF NOT EXISTS einladung (
      token_hash text PRIMARY KEY,
      email varchar(320) NOT NULL,
      erstellt_von uuid NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp NOT NULL,
      verwendet_am timestamp,
      benutzer_id uuid REFERENCES benutzer(id) ON DELETE SET NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS einladung_email_idx ON einladung (email)`;

  // Ohne diesen Schritt gäbe es nach der Migration keinen einzigen Admin.
  const [{ anzahl }] = await sql`
    SELECT count(*)::int AS anzahl FROM benutzer WHERE ist_admin
  `;
  if (anzahl === 0) {
    const [erster] = await sql`
      SELECT id, email FROM benutzer ORDER BY created_at ASC LIMIT 1
    `;
    if (erster) {
      await sql`UPDATE benutzer SET ist_admin = true WHERE id = ${erster.id}`;
      console.log(`\n  Admin gesetzt: ${erster.email} (ältestes Konto)`);
    } else {
      console.log("\n  Noch keine Konten — der erste registrierte wird Admin.");
    }
  } else {
    console.log(`\n  Admins vorhanden: ${anzahl} — nichts geändert.`);
  }

  console.log("\nFertig.");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
