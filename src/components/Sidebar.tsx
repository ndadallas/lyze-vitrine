import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { IconLogout } from "@/components/icons";

export function Sidebar({ home, children }: { home: string; children: ReactNode }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <Link href={home} className="logo" aria-label="Lyze, accueil de l'espace gérante">
          <img className="logo-name" src="/assets/img/logo-lyze-creme.png" alt="" width={599} height={200} />{/* eslint-disable-line @next/next/no-img-element */}
          <span className="eyebrow-light logo-sub">Espace gérante</span>
        </Link>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {children}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <hr className="hr-light" />
        <form action={logout}>
          <button type="submit" className="sidebar-link">
            <IconLogout />
            <span className="label">Déconnexion</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
