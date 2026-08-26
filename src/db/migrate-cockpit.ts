import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating modular_plan table...");
  await client`
    CREATE TABLE IF NOT EXISTS modular_plan (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      modul_id UUID NOT NULL REFERENCES modul(id) ON DELETE CASCADE,
      kw INTEGER NOT NULL,
      ziel VARCHAR(300) NOT NULL,
      beschreibung TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS modular_plan_modul_kw_idx
      ON modular_plan (modul_id, kw)
  `;

  console.log("Creating material_task table...");
  await client`
    CREATE TABLE IF NOT EXISTS material_task (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id UUID NOT NULL REFERENCES material(id) ON DELETE CASCADE,
      task_text TEXT NOT NULL,
      referenz VARCHAR(200),
      sortierung INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS material_task_material_idx
      ON material_task (material_id)
  `;

  console.log("Creating pendenz table...");
  await client`
    CREATE TABLE IF NOT EXISTS pendenz (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      klasse_id UUID NOT NULL REFERENCES klasse(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      erledigt BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS pendenz_klasse_idx ON pendenz (klasse_id)
  `;

  console.log("Adding cockpit_notiz column to sequenz...");
  await client`
    ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS cockpit_notiz TEXT
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
