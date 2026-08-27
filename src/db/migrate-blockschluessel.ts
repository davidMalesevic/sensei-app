import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  // Die Smartlearn-Exporte nummerieren Blöcke unterschiedlich: «Block 01»,
  // «Block 1», «Block A». Eine Ganzzahl reicht dafür nicht.
  console.log("Adding schluessel to modul_block...");
  await client`ALTER TABLE modul_block ADD COLUMN IF NOT EXISTS schluessel VARCHAR(10)`;
  await client`UPDATE modul_block SET schluessel = nummer::text WHERE schluessel IS NULL`;
  await client`ALTER TABLE modul_block ALTER COLUMN schluessel SET NOT NULL`;
  await client`ALTER TABLE modul_block ALTER COLUMN nummer DROP NOT NULL`;

  console.log("Replacing unique (modul_id, nummer) with (modul_id, schluessel)...");
  await client`ALTER TABLE modul_block DROP CONSTRAINT IF EXISTS modul_block_modul_id_nummer_key`;
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS modul_block_modul_schluessel_idx
      ON modul_block (modul_id, schluessel)
  `;

  console.log("Converting modular_plan.bloecke to text[]...");
  await client`
    ALTER TABLE modular_plan
      ALTER COLUMN bloecke TYPE TEXT[] USING bloecke::text[]
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
