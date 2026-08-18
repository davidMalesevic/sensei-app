import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating modul table...");
  await client`
    CREATE TABLE IF NOT EXISTS modul (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nummer INTEGER NOT NULL UNIQUE,
      bezeichnung VARCHAR(300)
    )
  `;

  console.log("Adding modul_id column to sequenz...");
  await client`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sequenz' AND column_name = 'modul_id'
      ) THEN
        ALTER TABLE sequenz ADD COLUMN modul_id UUID REFERENCES modul(id);
      END IF;
    END $$
  `;

  console.log("Seeding modules...");
  const moduleNummern = [
    119, 134, 162, 164, 168, 213, 218, 219, 220, 224,
    229, 230, 231, 235, 254, 278, 279, 282, 319, 325,
    331, 332, 333, 336, 337, 338, 339, 349, 367, 370,
    371, 372, 373, 374, 375, 377, 378, 379, 392, 394,
    395, 396,
  ];

  for (const nr of moduleNummern) {
    await client`
      INSERT INTO modul (nummer) VALUES (${nr})
      ON CONFLICT (nummer) DO NOTHING
    `;
  }

  console.log(`${moduleNummern.length} Module eingefügt.`);
  console.log("Migration abgeschlossen.");

  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
