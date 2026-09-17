import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

/** Methode am Einstieg und das ausgearbeitete Paket dazu. */
async function migrate() {
  console.log("Adding methode_schluessel to sequenz_ablauf...");
  await client`
    ALTER TABLE sequenz_ablauf
      ADD COLUMN IF NOT EXISTS methode_schluessel VARCHAR(80)
  `;

  console.log("Creating einstieg_paket...");
  await client`
    CREATE TABLE IF NOT EXISTS einstieg_paket (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequenz_id UUID NOT NULL UNIQUE REFERENCES sequenz(id) ON DELETE CASCADE,
      methode_schluessel VARCHAR(80) NOT NULL,
      methode_name VARCHAR(200) NOT NULL,
      dauer_minuten INTEGER,
      parameter JSONB NOT NULL,
      zusatzwuensche TEXT,
      inhalt JSONB NOT NULL,
      modell VARCHAR(100),
      erzeugt_am TIMESTAMP NOT NULL DEFAULT now()
    )
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
