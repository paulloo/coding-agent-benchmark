"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-muted font-medium text-ink"
          : "text-ink-soft hover:bg-canvas hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}
