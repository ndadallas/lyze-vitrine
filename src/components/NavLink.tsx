"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  const vue = useSearchParams().get("vue");
  // lien « /admin?vue=x » : actif seulement sur cet onglet ; « /admin » exact : actif sans onglet
  const [chemin, requete] = href.split("?");
  const cible = requete ? new URLSearchParams(requete).get("vue") : null;
  const active = requete
    ? pathname === chemin && vue === cible
    : exact
      ? pathname === href && !vue
      : pathname === href || pathname.startsWith(`${href}/`);

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
