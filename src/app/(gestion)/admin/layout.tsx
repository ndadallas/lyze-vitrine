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

  const [aValider, demandes, messages, reponses] = await Promise.all([
    db.booking.count({ where: { pending: true } }),
    db.ownerRequest.count({ where: { status: { in: ["NOUVELLE", "EN_COURS"] } } }),
    db.siteMessage.count({ where: { handled: false } }),
    db.noticeReply.count({ where: { fromAdmin: false, readAt: null } }),
  ]);
  const compte = (n: number) => (n > 0 ? ` (${n})` : "");
  const ONGLETS = [
    ["ca", "Chiffre d’affaires"],
    ["valider", `À valider${compte(aValider)}`],
    ["demandes", `Demandes${compte(demandes)}`],
    ["messages", `Messages du site${compte(messages)}`],
    ["reponses", `Réponses des propriétaires${compte(reponses)}`],
    ["nouveau", "Nouveau client"],
    ["clients", "Liste des clients"],
  ] as const;

  return (
    <div className="shell">
      <Sidebar home="/admin">
        <NavLink href="/admin" exact icon={<IconUsers />}>
          Tableau de bord
        </NavLink>
        {ONGLETS.map(([cle, libelle]) => (
          <NavLink key={cle} href={`/admin?vue=${cle}`} icon={null}>
            {libelle}
          </NavLink>
        ))}
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
