import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { UiShell } from "@/components/shell/ui-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";
import { getOffeneUebertraege } from "@/app/sequenzen/uebertrag-actions";
import { headers } from "next/headers";

import { aktuelleSession } from "@/lib/dal";
import { OEFFENTLICH_HEADER } from "@/proxy";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sensei – Unterrichtsplanung",
  description: "Planungstool für Berufsfachschullehrpersonen",
};

// Das Layout zählt offene Überträge — der rote Punkt darf nicht aus der
// Build-Zeit stammen.
export const dynamic = "force-dynamic";

// Setzt das Theme vor dem ersten Paint, damit es beim Laden nicht aufblitzt.
const THEME_SCRIPT = `try{if(localStorage.getItem("sensei-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // `aktuelleSession()` leitet NICHT um, wenn niemand angemeldet ist — sonst
  // gäbe es auf der Anmeldeseite eine Weiterleitungsschleife. Ohne Anmeldung
  // wird die Shell gar nicht gerendert und auch nichts aus der DB geladen.
  // Anmelden, Einladung und Passwort-Link stehen bewusst ohne Shell da —
  // auch für jemanden, der bereits angemeldet ist und einen Einladungslink
  // öffnet. Welcher Pfad das ist, sagt der Proxy über einen Header.
  const istOeffentlich =
    (await headers()).get(OEFFENTLICH_HEADER) === "1";

  const angemeldet = istOeffentlich ? null : await aktuelleSession();
  const offen = angemeldet ? await getOffeneUebertraege() : [];

  return (
    <html
      lang="de"
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <TooltipProvider>
          {angemeldet ? (
            <UiShell
              offeneUebertraege={offen.length}
              benutzerName={angemeldet.name}
              istAdmin={angemeldet.istAdmin}
            >
              {children}
            </UiShell>
          ) : (
            children
          )}
        </TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
