import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { FeedbackButton } from "@/components/feedback-button";
import { Analytics } from "@vercel/analytics/next";
import { getOffeneUebertraege } from "@/app/sequenzen/uebertrag-actions";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sensei – Unterrichtsplanung",
  description: "Planungstool für Berufsschullehrpersonen",
};

// Das Layout zählt offene Überträge — der rote Punkt darf nicht aus der
// Build-Zeit stammen.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const offen = await getOffeneUebertraege();

  return (
    <html
      lang="de"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar offeneUebertraege={offen.length} />
            <SidebarInset>
              <header className="flex h-12 shrink-0 items-center border-b border-border/60 px-6">
                <SidebarTrigger className="-ml-2" />
              </header>
              <main className="flex-1 p-8 lg:p-10">{children}</main>
            </SidebarInset>
          </SidebarProvider>
          <FeedbackButton />
        </TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
