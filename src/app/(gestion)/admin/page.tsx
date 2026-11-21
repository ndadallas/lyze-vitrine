import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { DemandeAdmin } from "@/components/Demandes";
import { basculerMessage, refuserResa, validerResa } from "@/app/actions/espace";

const jourCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
import { versDemandeItem } from "@/lib/espace";
import { createOwner } from "./actions";
import { addMonths, today } from "@/lib/dates";
import { formatMontant } from "@/lib/devise";
import { deviseCourante } from "@/lib/langue-serveur";
import { nights, overlapNights } from "@/lib/stats";
import { LogoPlateforme, type Plateforme } from "@/lib/plateformes";

export const metadata: Metadata = { title: "Clients" };

const lastLogin = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Casablanca",
});

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin();
  const { devise, tauxEur } = await deviseCourante();
  const montant = (mad: number) => formatMontant(mad, devise, tauxEur);
  // Recherche de clients (nom, identifiant, téléphone, e-mail, nom d'un bien) ; vide = tous les clients
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 80);
  // Onglet choisi dans la barre latérale (?vue=…) ; aucun = tout le tableau de bord
  const vue = String(sp.vue ?? "");
  const voir = (k: string, n = 1) => (vue ? vue === k : n > 0);
  const contient = { contains: q, mode: "insensitive" as const };

  const owners = await db.user.findMany({
    where: {
      role: "OWNER",
      ...(q
        ? {
            OR: [
              { firstName: contient },
              { lastName: contient },
              { username: contient },
              { phone: contient },
              { email: contient },
              { properties: { some: { OR: [{ name: contient }, { city: contient }] } } },
            ],
          }
        : {}),
    },
    orderBy: [{ active: "desc" }, { lastName: "asc" }],
    include: { _count: { select: { properties: true } } },
  });
  const totalClients = q ? await db.user.count({ where: { role: "OWNER" } }) : owners.length;
  // Réservations / blocages saisis par les propriétaires, à valider
  const aValider = await db.booking.findMany({
    where: { pending: true },
    orderBy: { startDate: "asc" },
    take: 50,
    include: { property: { select: { name: true, owner: { select: { id: true, firstName: true, lastName: true } } } } },
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

  // Réponses des propriétaires aux messages de Lyze, pas encore lues
  const reponses = await db.noticeReply.findMany({
    where: { fromAdmin: false, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { notice: { select: { title: true, owner: { select: { id: true, firstName: true, lastName: true } } } } },
  });

  // Chiffre d'affaires global (toutes réservations voyageurs, au prorata des nuits) : mois en cours et 12 derniers mois
  const t = today();
  const debutMois = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  const finMois = addMonths(debutMois, 1);
  const debut12 = addMonths(debutMois, -11);
  const ventes = await db.booking.findMany({
    where: { kind: "RESERVED", startDate: { lt: finMois }, endDate: { gt: debut12 } },
    select: { startDate: true, endDate: true, amount: true, fees: true, commission: true, platform: true },
  });
  // Dépenses de tous les biens sur la même période (déduites du net des propriétaires, demande 2026-11-21)
  const depensesPeriode = await db.expense.findMany({
    where: { date: { gte: debut12, lt: finMois } },
    select: { date: true, amount: true },
  });
  const somme = (de: Date, a: Date) => {
    const r = {
      ca: 0,
      frais: 0,
      lyze: 0,
      nuits: 0,
      depenses: depensesPeriode.filter((d) => d.date >= de && d.date < a).reduce((s, d) => s + d.amount, 0),
      parPlateforme: new Map<Plateforme, { ca: number; frais: number; lyze: number; nuits: number }>(),
    };
    for (const v of ventes) {
      const n = overlapNights(v, de, a);
      if (!n) continue;
      const part = n / (nights(v) || 1);
      r.ca += v.amount * part;
      r.frais += v.fees * part;
      r.lyze += v.commission * part;
      r.nuits += n;
      const p = r.parPlateforme.get(v.platform) ?? { ca: 0, frais: 0, lyze: 0, nuits: 0 };
      p.ca += v.amount * part;
      p.frais += v.fees * part;
      p.lyze += v.commission * part;
      p.nuits += n;
      r.parPlateforme.set(v.platform, p);
    }
    return r;
  };
  const caMois = somme(debutMois, finMois);
  const ca12 = somme(debut12, finMois);

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

      {voir("ca") && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="ca-title">
          <h2 id="ca-title" style={{ fontSize: 20 }}>Chiffre d’affaires</h2>
          {([["Mois en cours", caMois], ["12 derniers mois", ca12]] as const).map(([nom, r]) => (
            <div key={nom} className="ca-bloc">
              <h3>{nom}</h3>
              <dl className="ca-cases">
                <div><dt>Chiffre d’affaires</dt><dd>{montant(r.ca)}</dd><small>{r.nuits} nuits</small></div>
                <div><dt>Frais plateformes</dt><dd>− {montant(r.frais)}</dd><small>Airbnb, Booking…</small></div>
                <div className="ca-lyze"><dt>CA Lyze</dt><dd>{montant(r.lyze)}</dd><small>commissions</small></div>
                <div><dt>Dépenses</dt><dd>− {montant(r.depenses)}</dd><small>ménage, réparations…</small></div>
                <div className="ca-net"><dt>Net propriétaires</dt><dd>{montant(r.ca - r.frais - r.lyze - r.depenses)}</dd><small>après frais, commission et dépenses</small></div>
              </dl>
            </div>
          ))}
          {ca12.parPlateforme.size > 0 && (
            <div className="lz-table-defile">
              <table className="releve lz-fiches-mobile ca-table">
                <thead>
                  <tr><th scope="col">Par plateforme (12 mois)</th><th scope="col">Nuits</th><th scope="col">Chiffre d’affaires</th><th scope="col">Frais plateforme</th><th scope="col">CA Lyze</th></tr>
                </thead>
                <tbody>
                  {[...ca12.parPlateforme].map(([code, p]) => (
                    <tr key={code}>
                      <th scope="row"><LogoPlateforme code={code} taille={16} /></th>
                      <td data-label="Nuits">{p.nuits}</td>
                      <td data-label="Chiffre d’affaires">{montant(p.ca)}</td>
                      <td data-label="Frais plateforme">{montant(p.frais)}</td>
                      <td data-label="CA Lyze">{montant(p.lyze)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ fontSize: 13 }}>Réservations voyageurs de tous les clients, réparties au prorata des nuits. Frais et commission par défaut (Airbnb 18 %, Booking 20 %, autre 15 %, Lyze 20 %), modifiables sur chaque réservation. Dépenses = celles notées dans les biens des clients.</p>
        </section>
      )}

      {voir("valider", aValider.length) && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="valider-title">
          <h2 id="valider-title" style={{ fontSize: 20 }}>
            À valider <span className="muted" style={{ fontSize: 15 }}>({aValider.length})</span>
          </h2>
          <p className="muted" style={{ fontSize: 14 }}>
            Réservations et blocages ajoutés ou modifiés par les propriétaires dans leur espace. Validez-les ou refusez-les
            (refuser supprime la ligne du calendrier).
          </p>
          <ul className="lz-liste-dem">
            {aValider.map((b) => (
              <li key={b.id}>
                <div className="lz-dem-tete">
                  <strong>
                    {b.kind === "RESERVED" ? "Réservation" : b.kind === "BLOCKED" ? "Blocage" : "Réservé par l’entreprise"} ·{" "}
                    {b.property.name}
                  </strong>
                  <span className="lz-statut lz-statut-nouvelle">À valider</span>
                </div>
                <small className="lz-dem-meta">
                  <Link href={`/admin/clients/${b.property.owner.id}`}>
                    {b.property.owner.firstName} {b.property.owner.lastName}
                  </Link>
                  {" · "}
                  du {jourCourt.format(b.startDate)} au {jourCourt.format(b.endDate)}
                  {b.kind === "RESERVED" && ` · ${b.amount.toLocaleString("fr-FR")} MAD`}
                  {b.guestName && ` · ${b.guestName}`}
                </small>
                {b.note && <p className="lz-dem-message">{b.note}</p>}
                <div className="lz-actions-resa" style={{ marginTop: 6 }}>
                  <form action={validerResa}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button type="submit" className="lz-bouton lz-petit">Valider</button>
                  </form>
                  <form action={refuserResa}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button type="submit" className="lz-lien lz-danger">Refuser</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {voir("messages", messages.length) && (
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

      {voir("reponses", reponses.length) && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="reponses-title">
          <h2 id="reponses-title" style={{ fontSize: 20 }}>
            Réponses des propriétaires <span className="muted" style={{ fontSize: 15 }}>({reponses.length} à lire)</span>
          </h2>
          <ul className="lz-liste-dem">
            {reponses.map((r) => (
              <li key={r.id}>
                <div className="lz-dem-tete">
                  <strong>
                    {r.notice.owner.firstName} {r.notice.owner.lastName} · Re : {r.notice.title}
                  </strong>
                  <span className="lz-statut lz-statut-nouvelle">Nouveau</span>
                </div>
                <small className="lz-dem-meta">{lastLogin.format(r.createdAt)}</small>
                <p className="lz-dem-message">{r.body}</p>
                <Link href={`/admin/clients/${r.notice.owner.id}/messages`} className="btn btn-outline btn-sm">
                  Lire et répondre
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {voir("demandes", demandes.length) && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="demandes-title">
          <h2 id="demandes-title" style={{ fontSize: 20 }}>
            Demandes à traiter <span className="muted" style={{ fontSize: 15 }}>({demandes.length})</span>
          </h2>
          <ul className="lz-liste-dem">
            {demandes.map((r) => (
              <DemandeAdmin
                key={`${r.id}-${r.updatedAt.getTime()}`}
                d={versDemandeItem(r)}
                client={{ nom: `${r.owner.firstName} ${r.owner.lastName}`, lien: `/admin/clients/${r.owner.id}/demandes` }}
              />
            ))}
          </ul>
        </section>
      )}

      {voir("nouveau") && (
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
            <label htmlFor="civility">Civilité</label>
            <select id="civility" name="civility">
              <option value="">—</option>
              <option value="M">M.</option>
              <option value="MME">Mme</option>
            </select>
          </div>
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
      )}

      {voir("clients") && (
      <section className="stack" aria-labelledby="clients-title">
        <h2 id="clients-title" style={{ fontSize: 20 }}>
          Clients{" "}
          <span className="muted" style={{ fontSize: 15 }}>
            ({q ? `${owners.length} sur ${totalClients}` : owners.length})
          </span>
        </h2>
        <form className="lz-recherche" role="search" action="/admin">
          {vue && <input type="hidden" name="vue" value={vue} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Rechercher un client : nom, identifiant, téléphone, e-mail, bien…"
            aria-label="Rechercher un client"
          />
          <button type="submit" className="btn btn-primary">Rechercher</button>
          {q && <Link href="/admin" className="link">Tout voir</Link>}
        </form>

        {owners.length === 0 ? (
          <div className="card empty">{q ? `Aucun client ne correspond à « ${q} ».` : "Aucun client pour l'instant."}</div>
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
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link href={`/admin/clients/${o.id}/messages`} className="btn btn-outline btn-sm" style={{ marginRight: 8 }}>
                        Message
                      </Link>
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
      )}
    </>
  );
}
