import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

/**
 * Tabellen für die Methodenbibliothek. Die Inhalte kommen nicht von hier,
 * sondern über «Bibliothek einlesen» in /methoden (nur Admins) — so braucht
 * die Produktion keinen Tunnel, um die Datei zu laden.
 */
async function migrate() {
  console.log("Creating methoden_bibliothek...");
  await client`
    CREATE TABLE IF NOT EXISTS methoden_bibliothek (
      id VARCHAR(20) PRIMARY KEY,
      schema_version VARCHAR(20) NOT NULL,
      titel VARCHAR(300) NOT NULL,
      beschreibung TEXT,
      system_prompt TEXT NOT NULL,
      user_prompt_template TEXT NOT NULL,
      ausgabe_schema JSONB NOT NULL,
      sozialformen JSONB NOT NULL,
      schwerpunkte JSONB NOT NULL,
      kategorien JSONB NOT NULL,
      variablen JSONB NOT NULL,
      eingelesen_am TIMESTAMP NOT NULL DEFAULT now()
    )
  `;

  console.log("Creating methode...");
  await client`
    CREATE TABLE IF NOT EXISTS methode (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      benutzer_id UUID REFERENCES benutzer(id) ON DELETE CASCADE,
      schluessel VARCHAR(80) NOT NULL,
      basis_id UUID REFERENCES methode(id) ON DELETE SET NULL,
      name VARCHAR(200) NOT NULL,
      kategorie VARCHAR(60) NOT NULL,
      sozialform TEXT[] NOT NULL,
      dauer_min INTEGER NOT NULL,
      dauer_max INTEGER NOT NULL,
      dauer_standard INTEGER NOT NULL,
      schwerpunkt VARCHAR(20) NOT NULL,
      kurzbeschreibung TEXT NOT NULL,
      material TEXT[] NOT NULL,
      parameter JSONB NOT NULL,
      anweisung TEXT NOT NULL,
      daten_json_schema JSONB,
      sortierung INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT methode_benutzer_id_schluessel_unique
        UNIQUE NULLS NOT DISTINCT (benutzer_id, schluessel)
    )
  `;

  console.log("Creating methode_ausgeschaltet...");
  await client`
    CREATE TABLE IF NOT EXISTS methode_ausgeschaltet (
      benutzer_id UUID NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
      schluessel VARCHAR(80) NOT NULL,
      PRIMARY KEY (benutzer_id, schluessel)
    )
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
