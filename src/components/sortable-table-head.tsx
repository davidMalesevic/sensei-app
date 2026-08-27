"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowsVertical } from "@carbon/icons-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Carbon sortiert über die ganze Kopfzelle, nicht über ein kleines Symbol:
 * die Fläche ist der Knopf, der Pfeil erscheint beim Überfahren.
 * https://carbondesignsystem.com/components/data-table/style/#sortable
 */
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
    <TableHead className={cn("p-0", className)} aria-sort={
      isActive ? (currentOrder === "desc" ? "descending" : "ascending") : "none"
    }>
      <Link
        href={`${pathname}?${params.toString()}`}
        className="group/sort flex h-10 w-full items-center justify-between gap-2 px-4 transition-colors duration-[110ms] ease-carbon-standard hover:bg-layer-active focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {children}
        <span
          className={cn(
            "shrink-0 transition-opacity duration-[110ms]",
            isActive ? "opacity-100" : "opacity-0 group-hover/sort:opacity-100"
          )}
        >
          {isActive ? (
            currentOrder === "desc" ? (
              <ArrowDown size={16} />
            ) : (
              <ArrowUp size={16} />
            )
          ) : (
            <ArrowsVertical size={16} />
          )}
        </span>
      </Link>
    </TableHead>
  );
}
