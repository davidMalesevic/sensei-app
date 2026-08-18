"use client";

import {
  Calendar,
  BookOpen,
  Layers,
  GraduationCap,
  Paperclip,
  LayoutDashboard,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Semester",
    url: "/semester",
    icon: Calendar,
  },
  {
    title: "Klassen",
    url: "/klassen",
    icon: GraduationCap,
  },
  {
    title: "Sequenzen",
    url: "/sequenzen",
    icon: Layers,
  },
  {
    title: "Bildungsplan",
    url: "/bildungsplan",
    icon: BookOpen,
  },
  {
    title: "Materialien",
    url: "/materialien",
    icon: Paperclip,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border/60 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <svg viewBox="0 0 200 200" className="h-8 w-8 shrink-0" aria-hidden="true">
            <line x1="40" y1="100" x2="160" y2="100" stroke="currentColor" strokeWidth="6" />
            <circle cx="40" cy="100" r="14" fill="currentColor" />
            <circle cx="95" cy="100" r="20" fill="currentColor" />
            <circle cx="160" cy="100" r="28" className="fill-primary" />
          </svg>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tracking-tight leading-none">
              Sensei
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
              Unterrichtsplanung
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground px-5">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.url} />}
                    >
                      <item.icon className="!h-4 !w-4" />
                      <span className="text-[13px]">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/60 px-5 py-3">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          EDB — Berufsfachschule
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
