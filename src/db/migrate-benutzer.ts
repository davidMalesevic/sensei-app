/**
 * Login und Datentrennung pro Benutzer.
 *
 * Idempotent nach dem Muster der übrigen Migrationen (`CREATE TABLE IF NOT
 * EXISTS`, `ADD COLUMN IF NOT EXISTS`) — `drizzle-kit push` verlangt hier
 * einen interaktiven Prompt und bricht sonst ab.
 *
 *   npx tsx src/db/migrate-benutzer.ts
 *
 * Die `benutzer_id`-Spalten entstehen zuerst NULLbar. Erst wenn mit
 * `src/db/besitz-uebertragen.ts` ein Eigentümer für die bestehenden Daten
 * gesetzt ist, werden sie auf NOT NULL gezogen — sonst schlägt die Migration
 * auf einer Datenbank mit Inhalt fehl.
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

/** Tabellen, deren Zeilen genau einer Person gehören. */
const PERSOENLICH = [
  "klasse",
  "klasse_alias",
  "modul",
  "sequenz",
  "material",
  "pendenz",
] as const;

async function main() {
  console.log("→ Tabelle benutzer");
  await sql`
    CREATE TABLE IF NOT EXISTS benutzer (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(320) NOT NULL UNIQUE,
      name varchar(200) NOT NULL,
      passwort_hash text NOT NULL,
      bildungsplan_id uuid,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `;

  console.log("→ Tabelle session");
  await sql`
    CREATE TABLE IF NOT EXISTS session (
      token text PRIMARY KEY,
      benutzer_id uuid NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS session_benutzer_idx ON session (benutzer_id)`;

  console.log("→ bildungsplan.benutzer_id (NULL = geteilter Plan)");
  await sql`ALTER TABLE bildungsplan ADD COLUMN IF NOT EXISTS benutzer_id uuid`;

  for (const tabelle of PERSOENLICH) {
    console.log(`→ ${tabelle}.benutzer_id`);
    await sql`ALTER TABLE ${sql(tabelle)} ADD COLUMN IF NOT EXISTS benutzer_id uuid`;
  }

  // Fremdschlüssel getrennt anlegen: ADD CONSTRAINT kennt kein IF NOT EXISTS.
  console.log("→ Fremdschlüssel");
  const fks: [string, string, string][] = [
    ["bildungsplan", "bildungsplan_benutzer_fk", "CASCADE"],
    ["klasse", "klasse_benutzer_fk", "CASCADE"],
    ["klasse_alias", "klasse_alias_benutzer_fk", "CASCADE"],
    ["modul", "modul_benutzer_fk", "CASCADE"],
    ["sequenz", "sequenz_benutzer_fk", "CASCADE"],
    ["material", "material_benutzer_fk", "CASCADE"],
    ["pendenz", "pendenz_benutzer_fk", "CASCADE"],
  ];

  for (const [tabelle, name, aktion] of fks) {
    const da = await sql`
      SELECT 1 FROM pg_constraint WHERE conname = ${name}
    `;
    if (da.length === 0) {
      await sql.unsafe(
        `ALTER TABLE ${tabelle} ADD CONSTRAINT ${name}
         FOREIGN KEY (benutzer_id) REFERENCES benutzer(id) ON DELETE ${aktion}`
      );
      console.log(`   ${name} angelegt`);
    }
  }

  const bpFk = await sql`
    SELECT 1 FROM pg_constraint WHERE conname = 'benutzer_bildungsplan_fk'
  `;
  if (bpFk.length === 0) {
    await sql.unsafe(
      `ALTER TABLE benutzer ADD CONSTRAINT benutzer_bildungsplan_fk
       FOREIGN KEY (bildungsplan_id) REFERENCES bildungsplan(id) ON DELETE SET NULL`
    );
    console.log("   benutzer_bildungsplan_fk angelegt");
  }

  // Globale Eindeutigkeit wird zur Eindeutigkeit pro Konto: dasselbe
  // Kalenderkürzel und dieselbe Modulnummer gibt es bei mehreren Lehrpersonen.
  console.log("→ Unique-Constraints auf den Benutzer umstellen");
  await sql`ALTER TABLE klasse_alias DROP CONSTRAINT IF EXISTS klasse_alias_kuerzel_unique`;
  await sql`ALTER TABLE klasse_alias DROP CONSTRAINT IF EXISTS klasse_alias_kuerzel_key`;
  await sql`ALTER TABLE modul DROP CONSTRAINT IF EXISTS modul_nummer_unique`;
  await sql`ALTER TABLE modul DROP CONSTRAINT IF EXISTS modul_nummer_key`;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS klasse_alias_benutzer_kuerzel_idx
      ON klasse_alias (benutzer_id, kuerzel)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS modul_benutzer_nummer_idx
      ON modul (benutzer_id, nummer)
  `;

  // Wie viele Zeilen haben noch keinen Eigentümer?
  console.log("\nOffen (brauchen einen Eigentümer):");
  for (const tabelle of PERSOENLICH) {
    const [{ anzahl }] = await sql`
      SELECT count(*)::int AS anzahl FROM ${sql(tabelle)} WHERE benutzer_id IS NULL
    `;
    console.log(`  ${tabelle.padEnd(14)} ${anzahl}`);
  }

  console.log(
    "\nFertig. Als Nächstes: npx tsx src/db/besitz-uebertragen.ts <email>"
  );
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
