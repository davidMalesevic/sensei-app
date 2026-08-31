/**
 * Entfernt die Smartlearn-Resultate wieder — restlos.
 *
 *   npx tsx src/db/drop-resultate.ts --wirklich
 *
 * Das Feature ist ein Versuch. Dieses Script steht bewusst im selben Commit
 * wie die Migration, damit das Zurücknehmen dokumentiert ist und nicht später
 * rekonstruiert werden muss. Bestehende Tabellen sind nicht betroffen: die
 * Verbindung zum Modulbaum lief nur lesend über den LA-Code.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt — liegt .env.local am richtigen Ort?");
  process.exit(1);
}

if (!process.argv.includes("--wirklich")) {
  console.log(
    "Löscht resultat_abgabe, resultat_aufgabe, resultat_person und\n" +
      "resultat_import samt Inhalt. Zum Ausführen: --wirklich anhängen."
  );
  process.exit(0);
}

const sql = postgres(url, { max: 1 });

async function main() {
  // Reihenfolge egal wegen CASCADE, aber explizit ist ehrlicher.
  for (const t of [
    "resultat_abgabe",
    "resultat_aufgabe",
    "resultat_person",
    "resultat_import",
  ]) {
    await sql.unsafe(`DROP TABLE IF EXISTS ${t} CASCADE`);
    console.log(`  ${t} entfernt`);
  }
  console.log("\nFertig. Ausserdem zu entfernen, wenn es ganz weg soll:");
  console.log("  src/app/resultate/  src/lib/smartlearn-resultate.ts");
  console.log("  src/lib/resultate.ts  die resultat_*-Tabellen in src/db/schema.ts");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
