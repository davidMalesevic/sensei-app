"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";

export function SortableTableHead({
  column,
  children,
  className,
}: {
  column: string;
  children: React.ReactNode;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentSort = searchParams.get("sort");
  const currentOrder = searchParams.get("order");
  const isActive = currentSort === column;

  const nextOrder = isActive && currentOrder === "asc" ? "desc" : "asc";
  const params = new URLSearchParams(searchParams);
  params.set("sort", column);
  params.set("order", nextOrder);

  return (
    <TableHead className={className}>
      <Link
        href={`${pathname}?${params.toString()}`}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {isActive ? (
          currentOrder === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </Link>
    </TableHead>
  );
}
