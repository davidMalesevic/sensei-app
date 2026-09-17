import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  // Das Material-Etikett war eine Ganzzahl, Blöcke tragen aber seit
  // migrate-blockschluessel.ts einen Text («1», «A»). Ein Etikett auf Block A
  // liess sich deshalb gar nicht speichern.
  console.log("Adding block_schluessel to material...");
  await client`ALTER TABLE material ADD COLUMN IF NOT EXISTS block_schluessel VARCHAR(10)`;

  // Bestehende Etiketten übernehmen. Die alte Spalte bleibt stehen.
  const hatAlteSpalte = await client`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'material' AND column_name = 'block_nummer'
  `;
  if (hatAlteSpalte.length > 0) {
    const r = await client`
      UPDATE material SET block_schluessel = block_nummer::text
      WHERE block_schluessel IS NULL AND block_nummer IS NOT NULL
    `;
    console.log(`${r.count} Etiketten übernommen.`);
  }

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
