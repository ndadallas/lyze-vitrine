import Link from "next/link";
import { NavLink } from "@/components/NavLink";
import { Sidebar } from "@/components/Sidebar";
import { IconUsers } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { LangueProvider } from "@/components/Langue";
import { deviseCourante } from "@/lib/langue-serveur";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  // Menu déroulant des clients (demande 2026-11-18) : un clic ouvre la vue client, avec le titre et les rubriques de son espace
  const clients = await db.user.findMany({
    where: { role: "OWNER" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, passwordChangedAt: true },
  });

  const [aValider, demandes, messages, reponses] = await Promise.all([
    db.booking.count({ where: { pending: true } }),
    db.ownerRequest.count({ where: { status: { in: ["NOUVELLE", "EN_COURS"] } } }),
    db.siteMessage.count({ where: { handled: false } }),
    db.noticeReply.count({ where: { fromAdmin: false, readAt: null } }),
  ]);
  // Pastille rouge avec le nombre à traiter (demande 2026-11-21 : notification visible dans l'onglet)
  const ONGLETS: [string, string, number][] = [
    ["ca", "Chiffre d’affaires", 0],
    ["valider", "À valider", aValider],
    ["demandes", "Demandes", demandes],
    ["messages", "Messages du site", messages],
    ["reponses", "Réponses des propriétaires", reponses],
    ["documents", "Documents reçus", 0],
    ["archives", "Archives", 0],
    ["nouveau", "Nouveau client", 0],
    ["clients", "Liste des clients", 0],
  ];
  // Mot de passe changé par le client depuis moins de 7 jours : signalé sous son nom
  const recent = Date.now() - 7 * 24 * 3600 * 1000;

  const { devise, tauxEur } = await deviseCourante();
  return (
    <LangueProvider langue="fr" devise={devise} tauxEur={tauxEur}>
    <div className="shell">
      <Sidebar home="/admin">
        <NavLink href="/admin" exact icon={<IconUsers />}>
          Tableau de bord
        </NavLink>
        {ONGLETS.map(([cle, libelle, n]) => (
          <NavLink key={cle} href={`/admin?vue=${cle}`} icon={null}>
            {libelle}
            {n > 0 && (
              <span className="nav-pastille" aria-label={`${n} à traiter`}>
                {n}
              </span>
            )}
          </NavLink>
        ))}
        <details className="nav-clients" open>
          <summary>Clients ({clients.length})</summary>
          <ul>
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clients/${c.id}`}>
                  {c.firstName} {c.lastName}
                  {c.passwordChangedAt && c.passwordChangedAt.getTime() > recent && (
                    <span className="nav-mdp">mot de passe changé</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </Sidebar>
      <main className="content">{children}</main>
    </div>
    </LangueProvider>
  );
}
