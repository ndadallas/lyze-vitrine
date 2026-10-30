"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  exact = false,
  icon,
  children,
}: {
  href: string;
  exact?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`sidebar-link${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="label">{children}</span>
    </Link>
  );
}
