import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating sequenz_status enum...");
  await client`
    DO $$ BEGIN
      CREATE TYPE sequenz_status AS ENUM
        ('leer', 'entwurf', 'bestaetigt', 'gehalten');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  console.log("Creating klasse_alias table...");
  await client`
    CREATE TABLE IF NOT EXISTS klasse_alias (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      kuerzel VARCHAR(200) NOT NULL UNIQUE,
      klasse_id UUID NOT NULL REFERENCES klasse(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  console.log("Making sequenz.semester_id nullable...");
  await client`ALTER TABLE sequenz ALTER COLUMN semester_id DROP NOT NULL`;

  console.log("Adding Stundenplan-Felder to sequenz...");
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS kalender_kurs VARCHAR(50)`;
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS start_zeit VARCHAR(5)`;
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS end_zeit VARCHAR(5)`;
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS lektionen INTEGER`;
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS raum VARCHAR(50)`;
  await client`
    ALTER TABLE sequenz
      ADD COLUMN IF NOT EXISTS status sequenz_status NOT NULL DEFAULT 'leer'
  `;

  // Idempotenz-Schlüssel für den Import: Kurs + Tag ist im Export eindeutig
  // (verifiziert über alle 106 Sequenzen des Beispielexports).
  console.log("Creating unique index on (kalender_kurs, start_datum)...");
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS sequenz_kalender_idx
      ON sequenz (kalender_kurs, start_datum)
      WHERE kalender_kurs IS NOT NULL
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
