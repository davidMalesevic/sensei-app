/**
 * Überträgt die bestehenden Daten an ein Konto und zieht die
 * `benutzer_id`-Spalten danach auf NOT NULL.
 *
 *   npx tsx src/db/besitz-uebertragen.ts deine@email.ch
 *
 * Vorher `src/db/migrate-benutzer.ts` laufen lassen und sich über
 * `/registrieren` ein Konto anlegen. Läuft mehrfach ohne Schaden: es werden
 * nur Zeilen angefasst, die noch keinen Eigentümer haben.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt — liegt .env.local am richtigen Ort?");
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Aufruf: npx tsx src/db/besitz-uebertragen.ts <email>");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

const PERSOENLICH = [
  "klasse",
  "klasse_alias",
  "modul",
  "sequenz",
  "material",
  "pendenz",
] as const;

async function main() {
  const treffer = await sql`SELECT id, name FROM benutzer WHERE email = ${email}`;
  if (treffer.length === 0) {
    console.error(
      `Kein Konto für ${email}. Erst über /registrieren anlegen, dann dieses Script.`
    );
    await sql.end();
    process.exit(1);
  }

  const { id: benutzerId, name } = treffer[0];
  console.log(`Eigentümer: ${name} <${email}>\n`);

  for (const tabelle of PERSOENLICH) {
    const res = await sql`
      UPDATE ${sql(tabelle)} SET benutzer_id = ${benutzerId} WHERE benutzer_id IS NULL
    `;
    console.log(`  ${tabelle.padEnd(14)} ${res.count} Zeilen übertragen`);
  }

  // Der offizielle EDB-Bildungsplan bleibt geteilt (benutzer_id NULL) — er ist
  // niemandes Eigentum. Das Konto bekommt ihn nur zugewiesen.
  const plaene = await sql`
    SELECT id, bezeichnung FROM bildungsplan WHERE benutzer_id IS NULL ORDER BY bezeichnung LIMIT 1
  `;
  if (plaene.length > 0) {
    await sql`
      UPDATE benutzer SET bildungsplan_id = ${plaene[0].id}
      WHERE id = ${benutzerId} AND bildungsplan_id IS NULL
    `;
    console.log(`\n  Bildungsplan zugewiesen: ${plaene[0].bezeichnung} (geteilt)`);
  }

  // Jetzt, wo alles einen Eigentümer hat, darf die Spalte pflicht werden.
  console.log("\n→ NOT NULL setzen");
  for (const tabelle of PERSOENLICH) {
    const [{ offen }] = await sql`
      SELECT count(*)::int AS offen FROM ${sql(tabelle)} WHERE benutzer_id IS NULL
    `;
    if (offen > 0) {
      console.log(`  ${tabelle}: ${offen} Zeilen noch ohne Eigentümer — übersprungen`);
      continue;
    }
    await sql.unsafe(`ALTER TABLE ${tabelle} ALTER COLUMN benutzer_id SET NOT NULL`);
    console.log(`  ${tabelle.padEnd(14)} NOT NULL`);
  }

  console.log("\nFertig.");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
