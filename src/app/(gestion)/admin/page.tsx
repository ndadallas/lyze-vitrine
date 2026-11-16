import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { DemandeAdmin } from "@/components/Demandes";
import { basculerMessage } from "@/app/actions/espace";
import { versDemandeItem } from "@/lib/espace";
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
  // Demandes des propriétaires à traiter (toutes fiches confondues)
  const demandes = await db.ownerRequest.findMany({
    where: { status: { in: ["NOUVELLE", "EN_COURS"] } },
    orderBy: { createdAt: "asc" },
    take: 30,
    include: {
      property: { select: { name: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const messages = await db.siteMessage.findMany({
    orderBy: [{ handled: "asc" }, { createdAt: "desc" }],
    take: 40,
  });
  const nonTraites = messages.filter((m) => !m.handled).length;

  return (
    <>
      <div className="topbar">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Bonjour, {admin.firstName}</h1>
        </div>
      </div>

      {messages.length > 0 && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="messages-title">
          <h2 id="messages-title" style={{ fontSize: 20 }}>
            Messages du site <span className="muted" style={{ fontSize: 15 }}>({nonTraites} à traiter)</span>
          </h2>
          <p className="muted" style={{ fontSize: 14 }}>
            Demandes de réservation des voyageurs et demandes de rappel des propriétaires, envoyées depuis le site.
          </p>
          <ul className="lz-liste-dem">
            {messages.map((m) => (
              <li key={m.id} style={m.handled ? { opacity: 0.55 } : undefined}>
                <div className="lz-dem-tete">
                  <strong>
                    {m.type === "reservation" ? "Réservation" : "Rappel"} · {m.name}
                    {m.subject ? ` · ${m.subject}` : ""}
                  </strong>
                  <span className={`lz-statut ${m.handled ? "lz-statut-traitee" : "lz-statut-nouvelle"}`}>
                    {m.handled ? "Traité" : "Nouveau"}
                  </span>
                </div>
                <small className="lz-dem-meta">
                  {lastLogin.format(m.createdAt)} · <a href={`mailto:${m.email}`}>{m.email}</a>
                  {m.phone && (
                    <>
                      {" · "}
                      <a href={`https://wa.me/${m.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">{m.phone}</a>
                    </>
                  )}
                  {!m.mailSent && " · mail non envoyé (clé Resend absente)"}
                </small>
                {m.body && <p className="lz-dem-message">{m.body}</p>}
                <form action={basculerMessage}>
                  <input type="hidden" name="messageId" value={m.id} />
                  <button type="submit" className="lz-lien">{m.handled ? "Remettre à traiter" : "Marquer comme traité"}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {demandes.length > 0 && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="demandes-title">
          <h2 id="demandes-title" style={{ fontSize: 20 }}>
            Demandes à traiter <span className="muted" style={{ fontSize: 15 }}>({demandes.length})</span>
          </h2>
          <ul className="lz-liste-dem">
            {demandes.map((r) => (
              <DemandeAdmin
                key={`${r.id}-${r.updatedAt.getTime()}`}
                d={versDemandeItem(r)}
                client={{ nom: `${r.owner.firstName} ${r.owner.lastName}`, lien: `/admin/clients/${r.owner.id}` }}
              />
            ))}
          </ul>
        </section>
      )}

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
