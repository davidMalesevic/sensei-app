import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");
  const { modul } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  await db.execute(sql`ALTER TABLE modul ADD COLUMN IF NOT EXISTS lehrjahr integer`);
  console.log("Column modul.lehrjahr added");

  await db.execute(sql`ALTER TABLE sequenz ADD COLUMN IF NOT EXISTS uebergabenotiz text`);
  console.log("Column sequenz.uebergabenotiz added");

  const mapping: Record<number, number> = {
    119: 1, 134: 1, 162: 1, 224: 1, 230: 1, 254: 1, 319: 1, 331: 1, 332: 1, 370: 1, 374: 1, 375: 1,
    164: 2, 213: 2, 218: 2, 231: 2, 278: 2, 279: 2, 325: 2, 333: 2, 336: 2, 338: 2, 349: 2, 367: 2, 371: 2, 377: 2, 395: 2,
    168: 3, 219: 3, 220: 3, 282: 3, 337: 3, 372: 3, 378: 3, 392: 3, 394: 3,
    229: 4, 235: 4, 339: 4, 373: 4, 379: 4, 396: 4,
  };

  for (const [nummer, lehrjahr] of Object.entries(mapping)) {
    await db.update(modul).set({ lehrjahr }).where(eq(modul.nummer, parseInt(nummer)));
  }

  console.log("Lehrjahr values updated for all modules");
  process.exit(0);
}

main();
