"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Close,
  Dashboard,
  Calendar,
  Education,
  Layers,
  Book,
  Attachment,
  Analytics,
  Notification,
  Asleep,
  Light,
  UserAvatar,
  Logout,
  Settings,
  UserAdmin,
} from "@carbon/icons-react";

import { cn } from "@/lib/utils";
import { FeedbackButton } from "@/components/feedback-button";
import { abmelden } from "@/app/(auth)/actions";

const NAVIGATION = [
  { title: "Dashboard", url: "/", icon: Dashboard },
  { title: "Stundenplan", url: "/stundenplan", icon: Calendar },
  { title: "Klassen", url: "/klassen", icon: Education },
  { title: "Sequenzen", url: "/sequenzen", icon: Layers },
  { title: "Bildungsplan", url: "/bildungsplan", icon: Book },
  { title: "Materialien", url: "/materialien", icon: Attachment },
  { title: "Resultate", url: "/resultate", icon: Analytics },
];

const DESKTOP = "(min-width: 1024px)";

/** Ohne Effekt-State: der Server nimmt Desktop an, der Client korrigiert. */
function useIstDesktop() {
  return useSyncExternalStore(
    (melde) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", melde);
      return () => mq.removeEventListener("change", melde);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

/**
 * Carbon UI Shell: schwarze Kopfleiste (48 px) über einer SideNav (256 px).
 * https://carbondesignsystem.com/components/UI-shell-header/usage/
 */
export function UiShell({
  offeneUebertraege,
  benutzerName,
  istAdmin,
  instanzName,
  children,
}: {
  offeneUebertraege: number;
  benutzerName: string;
  istAdmin: boolean;
  /** «Sensei» oder «Sensei-Test» — kommt aus der Umgebung. */
  instanzName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const istDesktop = useIstDesktop();
  const [offenDesktop, setOffenDesktop] = useState(true);
  const [offenMobil, setOffenMobil] = useState(false);

  const offen = istDesktop ? offenDesktop : offenMobil;

  // Nach einem Seitenwechsel schliesst sich die Overlay-Navigation. Anpassung
  // während des Renderns statt im Effect — sonst rendert React zweimal.
  const [letzterPfad, setLetzterPfad] = useState(pathname);
  if (pathname !== letzterPfad) {
    setLetzterPfad(pathname);
    setOffenMobil(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <header
        data-slot="shell-header"
        className="fixed inset-x-0 top-0 z-50 flex h-12 items-center border-b border-shell-border bg-shell print:hidden"
      >
        <button
          type="button"
          onClick={() =>
            istDesktop ? setOffenDesktop((v) => !v) : setOffenMobil((v) => !v)
          }
          aria-label={offen ? "Navigation schliessen" : "Navigation öffnen"}
          aria-expanded={offen}
          className="flex h-12 w-12 shrink-0 items-center justify-center text-shell-text transition-colors duration-[110ms] ease-carbon-standard hover:bg-shell-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
        >
          {offen ? <Close size={20} /> : <Menu size={20} />}
        </button>

        <Link
          href="/"
          className="flex h-12 items-center gap-2 pr-4 pl-1 text-shell-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
        >
          <span className="type-body-compact-02 font-semibold">{instanzName}</span>
          <span className="type-body-compact-02 hidden text-shell-text-secondary sm:inline">
            Unterrichtsplanung
          </span>
        </Link>

        <div className="ml-auto flex h-12 items-center">
          <Link
            href="/stundenplan"
            aria-label={
              offeneUebertraege > 0
                ? `${offeneUebertraege} Lektionen ohne Übertrag`
                : "Keine offenen Überträge"
            }
            title={
              offeneUebertraege > 0
                ? `${offeneUebertraege} Lektionen ohne Übertrag`
                : "Keine offenen Überträge"
            }
            className="relative flex h-12 w-12 items-center justify-center text-shell-text transition-colors duration-[110ms] ease-carbon-standard hover:bg-shell-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
          >
            <Notification size={20} />
            {offeneUebertraege > 0 && (
              <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center bg-support-error px-1 text-xs leading-none font-semibold text-white">
                {offeneUebertraege > 99 ? "99+" : offeneUebertraege}
              </span>
            )}
          </Link>
          <FeedbackButton />
          <ThemeToggle />
          <BenutzerMenue name={benutzerName} istAdmin={istAdmin} />
        </div>
      </header>

      {/* Overlay nur unterhalb von lg */}
      <div
        onClick={() => setOffenMobil(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 top-12 z-30 bg-black/50 transition-opacity duration-[240ms] ease-carbon-standard lg:hidden print:hidden",
          offenMobil ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <nav
        data-slot="shell-nav"
        aria-label="Hauptnavigation"
        className={cn(
          "fixed top-12 bottom-0 left-0 z-40 w-64 border-r border-border-subtle bg-sidebar transition-transform duration-[240ms] ease-carbon-standard print:hidden",
          offen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col overflow-y-auto py-4">
          <ul>
            {(istAdmin
              ? [...NAVIGATION, { title: "Verwaltung", url: "/verwaltung", icon: UserAdmin }]
              : NAVIGATION
            ).map((item) => {
              const aktiv =
                item.url === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.url);
              const Icon = item.icon;

              return (
                <li key={item.url}>
                  <Link
                    href={item.url}
                    aria-current={aktiv ? "page" : undefined}
                    className={cn(
                      "type-body-compact-02 relative flex h-10 items-center gap-4 px-4 transition-colors duration-[110ms] ease-carbon-standard",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                      aktiv
                        ? "bg-layer-selected font-semibold text-foreground before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-border-interactive before:content-['']"
                        : "text-sidebar-foreground hover:bg-layer-hover hover:text-foreground",
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="truncate">{item.title}</span>
                    {item.url === "/stundenplan" && offeneUebertraege > 0 && (
                      <span
                        className="ml-auto h-2 w-2 shrink-0 rounded-full bg-support-error"
                        title={`${offeneUebertraege} Lektionen ohne Übertrag`}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="type-label-02 mt-auto px-4 pt-4 text-text-helper">
            Angemeldet als {benutzerName}
          </div>
        </div>
      </nav>

      <div
        data-slot="shell-content"
        className={cn(
          "pt-12 transition-[padding] duration-[240ms] ease-carbon-standard",
          offenDesktop ? "lg:pl-64" : "lg:pl-0",
          "print:pt-0 print:pl-0 lg:print:pl-0",
        )}
      >
        <main className="mx-auto max-w-[1584px] px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Die Klasse am <html> ist die Wahrheit — nicht ein zweiter State daneben. */
function useDunkel() {
  return useSyncExternalStore(
    (melde) => {
      const beobachter = new MutationObserver(melde);
      beobachter.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => beobachter.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

function ThemeToggle() {
  const dunkel = useDunkel();

  function umschalten() {
    const neu = !dunkel;
    document.documentElement.classList.toggle("dark", neu);
    try {
      localStorage.setItem("sensei-theme", neu ? "dark" : "light");
    } catch {
      // Privater Modus: dann eben nur für diese Sitzung.
    }
  }

  return (
    <button
      type="button"
      onClick={umschalten}
      aria-label={dunkel ? "Helles Design" : "Dunkles Design"}
      title={dunkel ? "Helles Design" : "Dunkles Design"}
      className="flex h-12 w-12 items-center justify-center text-shell-text transition-colors duration-[110ms] ease-carbon-standard hover:bg-shell-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
    >
      {dunkel ? <Light size={20} /> : <Asleep size={20} />}
    </button>
  );
}

/**
 * Global Action mit dem eigenen Namen und dem Weg hinaus.
 * Abmelden läuft über eine Form Action — ein onClick würde `revalidatePath`
 * und die Weiterleitung nicht zuverlässig auslösen.
 */
function BenutzerMenue({
  name,
  istAdmin,
}: {
  name: string;
  istAdmin: boolean;
}) {
  const [offen, setOffen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        aria-haspopup="menu"
        aria-label={`Angemeldet als ${name}`}
        title={name}
        className="flex h-12 items-center gap-2 px-4 text-shell-text transition-colors duration-[110ms] ease-carbon-standard hover:bg-shell-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
      >
        <UserAvatar size={20} />
        <span className="type-body-compact-02 hidden max-w-32 truncate md:inline">
          {name}
        </span>
      </button>

      {offen && (
        <>
          {/* Klick daneben schliesst das Menü. */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOffen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 w-64 bg-layer shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
          >
            <div className="border-b border-border-subtle px-4 py-3">
              <div className="type-label-02 text-text-helper">Angemeldet als</div>
              <div className="type-body-compact-02 truncate text-foreground">
                {name}
              </div>
            </div>
            <Link
              href="/mein-konto"
              role="menuitem"
              onClick={() => setOffen(false)}
              className="type-body-compact-02 flex h-12 w-full items-center justify-between px-4 text-foreground transition-colors duration-[110ms] ease-carbon-standard hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Mein Konto
              <Settings size={16} />
            </Link>
            {istAdmin && (
              <Link
                href="/verwaltung"
                role="menuitem"
                onClick={() => setOffen(false)}
                className="type-body-compact-02 flex h-12 w-full items-center justify-between border-t border-border-subtle px-4 text-foreground transition-colors duration-[110ms] ease-carbon-standard hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                Verwaltung
                <UserAdmin size={16} />
              </Link>
            )}
            <form action={abmelden} className="border-t border-border-subtle">
              <button
                type="submit"
                role="menuitem"
                className="type-body-compact-02 flex h-12 w-full items-center justify-between px-4 text-left text-foreground transition-colors duration-[110ms] ease-carbon-standard hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                Abmelden
                <Logout size={16} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
