import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  // Dasselbe Modul läuft mit mehreren Klassen — am Freitag zweimal 168 und
  // zweimal 219, dienstags zweimal 278. Einmal planen, dann übernehmen.
  console.log("Adding uebernommen_von to sequenz...");
  await client`
    ALTER TABLE sequenz
      ADD COLUMN IF NOT EXISTS uebernommen_von UUID
        REFERENCES sequenz(id) ON DELETE SET NULL
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
