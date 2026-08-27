import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { UiShell } from "@/components/shell/ui-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";
import { getOffeneUebertraege } from "@/app/sequenzen/uebertrag-actions";

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
  const offen = await getOffeneUebertraege();

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
          <UiShell offeneUebertraege={offen.length}>{children}</UiShell>
        </TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
