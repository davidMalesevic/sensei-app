@AGENTS.md

# Sensei App

Unterrichtsplanungs-Tool für Berufsschullehrpersonen (Schweiz). UI-Sprache ist Deutsch.

## Tech-Stack

- **Next.js 16** (App Router, Turbopack, Server Actions)
- **React 19** + TypeScript
- **shadcn/ui v4** (basiert auf `@base-ui/react`, NICHT auf Radix)
- **Tailwind CSS v4**
- **Drizzle ORM** + PostgreSQL via Supabase (Session Pooler)
- **lucide-react** für Icons

## shadcn/ui v4 — wichtige Unterschiede

Diese Version nutzt `@base-ui/react` statt Radix. Häufige Fehlerquellen:

- **`render` statt `asChild`**: Composition erfolgt über die `render` Prop.
  ```tsx
  // ✅ Richtig
  <Button render={<Link href="/foo" />}>Text</Button>
  <DialogTrigger render={<Button variant="outline" />}>Text</DialogTrigger>
  
  // ❌ Falsch — asChild existiert nicht
  <Button asChild><Link href="/foo">Text</Link></Button>
  ```
- **Accordion hat kein `type` Prop** — unterstützt mehrere offene Items standardmässig.
  ```tsx
  // ✅ Richtig
  <Accordion defaultValue={["item-1", "item-2"]}>
  
  // ❌ Falsch
  <Accordion type="multiple" defaultValue={[...]}>
  ```
- **Select mit leeren Werten**: Leere Strings `""` als `value` vermeiden. Stattdessen Sentinel-Werte verwenden (z.B. `"keine"`, `"frei"`) und in Server Actions abfangen.

## Datenbank

- **Supabase Session Pooler** auf Port 5432 (nicht Direct Connection)
- Connection-String in `.env.local` als `DATABASE_URL`
- Schema: `src/db/schema.ts` (13 Tabellen)
- Seed-Daten: `src/db/seed.ts` (Bildungsplan EDB + Phasenmodelle AVIVA/PADUA)

## Befehle

```bash
npm run dev              # Dev-Server starten (Port 3000)
npx drizzle-kit push     # Schema auf DB pushen
npx tsx src/db/seed.ts   # Seed-Daten laden
npx tsc --noEmit         # Type-Check
```

## Projektstruktur

```
src/
├── app/
│   ├── page.tsx                  # Dashboard
│   ├── semester/                 # Semester CRUD + Kalenderansicht
│   ├── klassen/                  # Klassen CRUD
│   ├── sequenzen/                # Sequenzen CRUD + Detailseite mit Lektionsblöcken/Phasen
│   ├── bildungsplan/             # HKB/HK-Übersicht + Coverage-Matrix
│   └── materialien/              # Material-Übersicht
├── components/
│   ├── ui/                       # shadcn/ui Komponenten
│   ├── app-sidebar.tsx           # Navigation
│   └── material-section.tsx      # Wiederverwendbare Material-Komponente
└── db/
    ├── index.ts                  # DB-Verbindung (postgres-js + Drizzle)
    ├── schema.ts                 # Drizzle Schema
    └── seed.ts                   # Bildungsplan EDB + AVIVA/PADUA
```

## Patterns

- **Server Actions** für alle CRUD-Operationen (`"use server"` in `actions.ts` Dateien)
- **Server Components** für Seiten, **Client Components** für interaktive Teile (`"use client"`)
- **FormData** basierte Actions mit `revalidatePath` + `redirect`
- Alle Tabellen nutzen **UUID** Primary Keys mit `defaultRandom()`
- Cascading Deletes auf Foreign Keys
