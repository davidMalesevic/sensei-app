/**
 * Kommentare an einzelnen Abschnitten des Ablaufs, die beim Neu-Erzeugen
 * berücksichtigt werden.
 *
 * `sequenz.ablauf_hinweise` — eine Liste `{ anker, text }`. Der Anker hängt
 * den Kommentar an die Aufgabe (`fakt:<marke>`) oder an die Stelle in der
 * Dramaturgie (`typ:einstieg`), nicht an die Zeile: die Zeile wird beim
 * Erzeugen gelöscht und neu geschrieben.
 *
 * Idempotent. Kein `drizzle-kit push` — das verlangt einen interaktiven TTY.
 */
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Ablauf-Hinweise an sequenz ...");
  await client`
    ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS ablauf_hinweise JSONB
  `;

  console.log("Migration abgeschlossen.");
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration-Fehler:", err);
  process.exit(1);
});
