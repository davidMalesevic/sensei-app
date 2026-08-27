import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding Übertrag-Felder to sequenz...");
  // Der Übertrag ist die einzige Eingabe nach der Lektion: bis wo sind wir
  // gekommen. Die App kann das nicht ableiten — siehe erstellungsprozess.md 6.4.
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS uebertrag TEXT`;
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS uebertrag_erledigt TEXT[]`;
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS uebertrag_slide_bis INTEGER`;
  await client`
    ALTER TABLE sequenz
      ADD COLUMN IF NOT EXISTS kein_uebertrag BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS uebertrag_am TIMESTAMP`;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
