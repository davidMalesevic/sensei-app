import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating modul_block table...");
  await client`
    CREATE TABLE IF NOT EXISTS modul_block (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      modul_id UUID NOT NULL REFERENCES modul(id) ON DELETE CASCADE,
      nummer INTEGER NOT NULL,
      titel VARCHAR(300) NOT NULL,
      slide_material_id UUID REFERENCES material(id) ON DELETE SET NULL,
      slide_von INTEGER,
      slide_bis INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (modul_id, nummer)
    )
  `;

  console.log("Creating modul_auftrag table...");
  await client`
    CREATE TABLE IF NOT EXISTS modul_auftrag (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      block_id UUID NOT NULL REFERENCES modul_block(id) ON DELETE CASCADE,
      code VARCHAR(200) NOT NULL,
      ausgangslage TEXT,
      aufgabenstellung TEXT,
      guetekriterien TEXT,
      sortierung INTEGER NOT NULL DEFAULT 0,
      UNIQUE (block_id, code)
    )
  `;

  console.log("Creating modul_aufgabe table...");
  await client`
    CREATE TABLE IF NOT EXISTS modul_aufgabe (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auftrag_id UUID NOT NULL REFERENCES modul_auftrag(id) ON DELETE CASCADE,
      parent_id UUID REFERENCES modul_aufgabe(id) ON DELETE CASCADE,
      bezeichnung VARCHAR(200) NOT NULL,
      text TEXT,
      sortierung INTEGER NOT NULL DEFAULT 0
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS modul_aufgabe_auftrag_idx
      ON modul_aufgabe (auftrag_id, sortierung)
  `;

  // KW → Block ist die Kette, aus der sich die Aufgaben einer Sequenz ergeben.
  console.log("Adding bloecke/la_codes to modular_plan...");
  await client`ALTER TABLE modular_plan ADD COLUMN IF NOT EXISTS bloecke INTEGER[]`;
  await client`ALTER TABLE modular_plan ADD COLUMN IF NOT EXISTS la_codes TEXT[]`;

  // Etikett am Material: NULL = gilt fürs ganze Modul, sonst genau ein Block.
  console.log("Adding block_nummer to material...");
  await client`ALTER TABLE material ADD COLUMN IF NOT EXISTS block_nummer INTEGER`;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
