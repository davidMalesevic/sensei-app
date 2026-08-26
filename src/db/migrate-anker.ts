import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding lb_hinweis to modular_plan...");
  await client`ALTER TABLE modular_plan ADD COLUMN IF NOT EXISTS lb_hinweis TEXT`;

  console.log("Adding bezeichnung to material_task...");
  await client`ALTER TABLE material_task ADD COLUMN IF NOT EXISTS bezeichnung VARCHAR(200)`;

  console.log("Creating anker_art enum...");
  await client`
    DO $$ BEGIN
      CREATE TYPE anker_art AS ENUM
        ('einstieg', 'repetition', 'aufgabe', 'referenz', 'modus', 'notiz');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  console.log("Creating sequenz_anker table...");
  await client`
    CREATE TABLE IF NOT EXISTS sequenz_anker (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequenz_id UUID NOT NULL REFERENCES sequenz(id) ON DELETE CASCADE,
      art anker_art NOT NULL,
      titel VARCHAR(300) NOT NULL,
      text TEXT,
      sortierung INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS sequenz_anker_sequenz_idx
      ON sequenz_anker (sequenz_id, sortierung)
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
