import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Creating ablauf enums...");
  await client`
    DO $$ BEGIN
      CREATE TYPE ablauf_typ AS ENUM
        ('einstieg', 'praxisbezug', 'theorie', 'aufgabe',
         'besprechung', 'abschluss', 'frei');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
  // Fakten stammen aus dem Material und dürfen nicht halluziniert werden,
  // Vorschläge kommen von der KI. Der Unterschied ist im Cockpit sichtbar.
  await client`
    DO $$ BEGIN
      CREATE TYPE ablauf_quelle AS ENUM ('fakt', 'vorschlag');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  console.log("Creating sequenz_ablauf table...");
  await client`
    CREATE TABLE IF NOT EXISTS sequenz_ablauf (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequenz_id UUID NOT NULL REFERENCES sequenz(id) ON DELETE CASCADE,
      sortierung INTEGER NOT NULL DEFAULT 0,
      typ ablauf_typ NOT NULL,
      quelle ablauf_quelle NOT NULL DEFAULT 'vorschlag',
      titel VARCHAR(300) NOT NULL,
      text TEXT,
      ref_code VARCHAR(200),
      ref_aufgabe VARCHAR(200),
      ref_material_id UUID REFERENCES material(id) ON DELETE SET NULL,
      ref_seite_von INTEGER,
      ref_seite_bis INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS sequenz_ablauf_sequenz_idx
      ON sequenz_ablauf (sequenz_id, sortierung)
  `;

  console.log("Adding entwurf_am to sequenz...");
  await client`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS entwurf_am TIMESTAMP`;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
