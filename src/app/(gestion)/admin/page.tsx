import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { createOwner } from "./actions";

export const metadata: Metadata = { title: "Clients" };

const lastLogin = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Casablanca",
});

export default async function AdminPage() {
  const admin = await requireAdmin();

  const owners = await db.user.findMany({
    where: { role: "OWNER" },
    orderBy: [{ active: "desc" }, { lastName: "asc" }],
    include: { _count: { select: { properties: true } } },
  });

  return (
    <>
      <div className="topbar">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Bonjour, {admin.firstName}</h1>
        </div>
      </div>

      <section className="card card-pad stack" style={{ gap: 20 }} aria-labelledby="new-client">
        <div>
          <h2 id="new-client" style={{ fontSize: 20 }}>Nouveau client</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>
            Indiquez le prénom et le nom, puis cliquez sur « Créer les accès ». L&apos;identifiant
            et le mot de passe sont générés tout seuls, il ne reste qu&apos;à les envoyer.
          </p>
        </div>
        <ActionForm action={createOwner} submitLabel="Créer les accès" className="form-grid">
          <div className="field">
            <label htmlFor="firstName">Prénom</label>
            <input id="firstName" name="firstName" required autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="lastName">Nom</label>
            <input id="lastName" name="lastName" required autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="phone">WhatsApp (facultatif)</label>
            <input id="phone" name="phone" type="tel" placeholder="06 12 34 56 78" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="email">Email (facultatif)</label>
            <input id="email" name="email" type="email" autoComplete="off" />
          </div>
        </ActionForm>
      </section>

      <section className="stack" aria-labelledby="clients-title">
        <h2 id="clients-title" style={{ fontSize: 20 }}>
          Clients <span className="muted" style={{ fontSize: 15 }}>({owners.length})</span>
        </h2>

        {owners.length === 0 ? (
          <div className="card empty">Aucun client pour l&apos;instant.</div>
        ) : (
          <div className="card table-wrap">
            <table className="table table-fiches">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Identifiant</th>
                  <th scope="col">Biens</th>
                  <th scope="col">Dernière connexion</th>
                  <th scope="col">Statut</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/clients/${o.id}`} className="link" style={{ fontSize: 14 }}>
                        {o.firstName} {o.lastName}
                      </Link>
                    </td>
                    <td data-label="Identifiant"><span style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 13 }}>{o.username}</span></td>
                    <td data-label="Biens">{o._count.properties}</td>
                    <td data-label="Dernière connexion" className="muted">{o.lastLoginAt ? lastLogin.format(o.lastLoginAt) : "Jamais"}</td>
                    <td data-label="Statut">
                      <span className={o.active ? "pill pill-free" : "pill pill-blocked"}>
                        {o.active ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/admin/clients/${o.id}`} className="btn btn-outline btn-sm">
                        Modifier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
