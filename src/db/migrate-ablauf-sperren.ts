/**
 * Der Ablauf gehört der Lehrperson, nicht dem Generator.
 *
 * - `sequenz_ablauf.gesperrt` — die Zeile überlebt ein «Neu erzeugen».
 * - `sequenz.ausgeschlossene_fakten` — Aufgaben, die in dieser Lektion nicht
 *   geplant werden sollen. Ohne das kam eine gelöschte Aufgabe zurück, weil
 *   der Generator übergangene Fakten bewusst wieder anhängt.
 *
 * Idempotent. Kein `drizzle-kit push` — das verlangt einen interaktiven TTY.
 */
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Sperre an sequenz_ablauf ...");
  await client`
    ALTER TABLE sequenz_ablauf
      ADD COLUMN IF NOT EXISTS gesperrt BOOLEAN NOT NULL DEFAULT FALSE
  `;

  console.log("Ausgeschlossene Fakten an sequenz ...");
  await client`
    ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS ausgeschlossene_fakten TEXT[]
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
