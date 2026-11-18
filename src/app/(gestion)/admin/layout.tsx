import Link from "next/link";
import { NavLink } from "@/components/NavLink";
import { Sidebar } from "@/components/Sidebar";
import { IconUsers } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  // Menu déroulant des clients (demande 2026-11-18) : un clic ouvre la vue client, avec le titre et les rubriques de son espace
  const clients = await db.user.findMany({
    where: { role: "OWNER" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  return (
    <div className="shell">
      <Sidebar home="/admin">
        <NavLink href="/admin" icon={<IconUsers />}>
          Tableau de bord
        </NavLink>
        <details className="nav-clients" open>
          <summary>Clients ({clients.length})</summary>
          <ul>
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clients/${c.id}`}>
                  {c.firstName} {c.lastName}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </Sidebar>
      <main className="content">{children}</main>
    </div>
  );
}
