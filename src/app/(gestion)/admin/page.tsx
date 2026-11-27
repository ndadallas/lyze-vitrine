import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { DemandeAdmin } from "@/components/Demandes";
import { basculerMessage, refuserResa, supprimerAvis, supprimerDemande, supprimerDocument, supprimerMessageSite, validerResa } from "@/app/actions/espace";
import { MarquerDocumentsVus } from "@/components/Documents";
import { ConfirmButton } from "@/components/ConfirmButton";

const jourCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
import { CATEGORIES_DOC, STATUTS_DEMANDE, TYPES_DEMANDE, documentUrl, versDemandeItem } from "@/lib/espace";
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
  // les demandes de blocage de dates sont traitées dans « À valider » (demande 2026-11-25)
  const toutesDemandes = await db.ownerRequest.findMany({
    where: { status: { in: ["NOUVELLE", "EN_COURS"] } },
    orderBy: { createdAt: "asc" },
    take: 30,
    include: {
      property: { select: { name: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  const blocages = toutesDemandes.filter((d) => d.type === "USAGE_PERSO");
  const demandes = toutesDemandes.filter((d) => d.type !== "USAGE_PERSO");

  // Chiffre d'affaires global (toutes réservations voyageurs, au prorata des nuits) : mois en cours et 12 derniers mois
  const t = today();
  const debutMois = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  const finMois = addMonths(debutMois, 1);
  const debut12 = addMonths(debutMois, -11);
  const ventes = await db.booking.findMany({
    where: { kind: "RESERVED", startDate: { lt: finMois }, endDate: { gt: debut12 } },
    select: { startDate: true, endDate: true, amount: true, fees: true, commission: true, platform: true, property: { select: { ownerId: true } } },
  });
  // Dépenses de tous les biens sur la même période (déduites du net des propriétaires, demande 2026-11-21)
  const depensesPeriode = await db.expense.findMany({
    where: { date: { gte: debut12, lt: finMois } },
    select: { date: true, amount: true, property: { select: { ownerId: true } } },
  });
  // Récapitulatif par client (demande 2026-11-21) : tous les propriétaires, même sans vente
  const proprietaires = await db.user.findMany({
    where: { role: "OWNER" },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const somme = (de: Date, a: Date) => {
    const r = {
      ca: 0,
      frais: 0,
      lyze: 0,
      nuits: 0,
      depenses: depensesPeriode.filter((d) => d.date >= de && d.date < a).reduce((s, d) => s + d.amount, 0),
      parPlateforme: new Map<Plateforme, { ca: number; frais: number; lyze: number; nuits: number }>(),
      parClient: new Map<string, { ca: number; frais: number; lyze: number; nuits: number; depenses: number }>(),
    };
    const client = (id: string) => {
      const c = r.parClient.get(id) ?? { ca: 0, frais: 0, lyze: 0, nuits: 0, depenses: 0 };
      r.parClient.set(id, c);
      return c;
    };
    for (const d of depensesPeriode) if (d.date >= de && d.date < a) client(d.property.ownerId).depenses += d.amount;
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
      const c = client(v.property.ownerId);
      c.ca += v.amount * part;
      c.frais += v.fees * part;
      c.lyze += v.commission * part;
      c.nuits += n;
    }
    return r;
  };
  const caMois = somme(debutMois, finMois);
  const ca12 = somme(debut12, finMois);

  // Traités = rangés dans Archives (demande 2026-11-22 : ne plus disparaître, pouvoir supprimer)
  const messages = await db.siteMessage.findMany({ where: { handled: false }, orderBy: { createdAt: "desc" }, take: 40 });
  const nonTraites = messages.length;
  const archives = vue === "archives";
  const [demandesArch, messagesArch, conversationsArch] = archives
    ? await Promise.all([
        db.ownerRequest.findMany({
          where: { status: { in: ["TRAITEE", "REFUSEE"] } },
          orderBy: { updatedAt: "desc" },
          take: 100,
          include: { property: { select: { name: true } }, owner: { select: { id: true, firstName: true, lastName: true } } },
        }),
        db.siteMessage.findMany({ where: { handled: true }, orderBy: { createdAt: "desc" }, take: 100 }),
        db.ownerNotice.findMany({
          where: { closedAt: { not: null } },
          orderBy: { closedAt: "desc" },
          take: 100,
          include: { owner: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { replies: true } } },
        }),
      ])
    : [[], [], []];
  // Documents envoyés par les propriétaires (dernier mois)
  const docsRecus = await db.document.findMany({
    where: { byAdmin: false, createdAt: { gte: addMonths(t, -1) } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, title: true, category: true, createdAt: true, seenAt: true, property: { select: { name: true } }, owner: { select: { id: true, firstName: true, lastName: true } } },
  });

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
                      <td data-label="CA Lyze" className="ca-lyze-col">{montant(p.lyze)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {proprietaires.length > 0 && (
            <div className="lz-table-defile">
              <table className="releve lz-fiches-mobile ca-table">
                <thead>
                  <tr><th scope="col">Par client (12 mois)</th><th scope="col">CA du mois</th><th scope="col">Nuits</th><th scope="col">Chiffre d’affaires</th><th scope="col">Frais plateformes</th><th scope="col">CA Lyze</th><th scope="col">Dépenses</th><th scope="col">Net propriétaire</th></tr>
                </thead>
                <tbody>
                  {proprietaires.map((o) => {
                    const c = ca12.parClient.get(o.id) ?? { ca: 0, frais: 0, lyze: 0, nuits: 0, depenses: 0 };
                    return (
                      <tr key={o.id}>
                        <th scope="row"><Link href={`/admin/clients/${o.id}/revenus`}>{o.firstName} {o.lastName}</Link></th>
                        <td data-label="CA du mois">{montant(caMois.parClient.get(o.id)?.ca ?? 0)}</td>
                        <td data-label="Nuits">{c.nuits}</td>
                        <td data-label="Chiffre d’affaires">{montant(c.ca)}</td>
                        <td data-label="Frais plateformes">{"−\u00a0"}{montant(c.frais)}</td>
                        <td data-label="CA Lyze" className="ca-lyze-col">{montant(c.lyze)}</td>
                        <td data-label="Dépenses">{"−\u00a0"}{montant(c.depenses)}</td>
                        <td data-label="Net propriétaire"><strong>{montant(c.ca - c.frais - c.lyze - c.depenses)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ fontSize: 13 }}>Réservations voyageurs de tous les clients, réparties au prorata des nuits. Frais et commission par défaut (Airbnb 18 %, Booking 20 %, autre 15 %, Lyze 20 %), modifiables sur chaque réservation. Dépenses = celles notées dans les biens des clients.</p>
        </section>
      )}

      {voir("valider", aValider.length + blocages.length) && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="valider-title">
          <h2 id="valider-title" style={{ fontSize: 20 }}>
            À valider <span className="muted" style={{ fontSize: 15 }}>({aValider.length + blocages.length})</span>
          </h2>
          <p className="muted" style={{ fontSize: 14 }}>
            Réservations et blocages ajoutés ou modifiés par les propriétaires dans leur espace. Validez-les ou refusez-les
            (refuser supprime la ligne du calendrier). Les demandes de blocage de dates des clients sont aussi ici : passez-les en
            « Traitée » (ou cochez le blocage) pour bloquer les dates dans leur calendrier.
          </p>
          {blocages.length > 0 && (
            <ul className="lz-liste-dem">
              {blocages.map((r) => (
                <DemandeAdmin
                  key={`${r.id}-${r.updatedAt.getTime()}`}
                  d={versDemandeItem(r)}
                  client={{ nom: `${r.owner.firstName} ${r.owner.lastName}`, lien: `/admin/clients/${r.owner.id}/demandes` }}
                />
              ))}
            </ul>
          )}
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
                  {b.kind === "RESERVED" && ` · ${b.amount.toLocaleString("fr-FR")} DH`}
                  {b.guestName && ` · ${b.guestName}`}
                </small>
                {b.note && <p className="lz-dem-message">{b.note}</p>}
                <div className="lz-actions-resa" style={{ marginTop: 6 }}>
                  <form action={validerResa} data-ok="Réservation validée.">
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button type="submit" className="lz-bouton lz-petit">Valider</button>
                  </form>
                  <form action={refuserResa} data-ok="Réservation refusée et supprimée.">
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
            Demandes de réservation des voyageurs, demandes de rappel et mots de passe oubliés, envoyés depuis le site.
            Une fois traités, ils sont rangés dans <Link href="/admin?vue=archives">Archives</Link>.
          </p>
          <ul className="lz-liste-dem">
            {messages.map((m) => (
              <li key={m.id} style={m.handled ? { opacity: 0.55 } : undefined}>
                <div className="lz-dem-tete">
                  <strong>
                    {m.type === "reservation" ? "Réservation" : m.type === "mdp" ? "Mot de passe oublié" : "Rappel"} · {m.name}
                    {m.subject ? ` · ${m.subject}` : ""}
                  </strong>
                  <span className={`lz-statut ${m.handled ? "lz-statut-traitee" : "lz-statut-nouvelle"}`}>
                    {m.handled ? "Traité" : "Nouveau"}
                  </span>
                </div>
                <small className="lz-dem-meta">
                  <strong className="lz-date">{lastLogin.format(m.createdAt)}</strong>{m.email && <> · <a href={`mailto:${m.email}`}>{m.email}</a></>}
                  {m.phone && (
                    <>
                      {" · "}
                      <a href={`https://wa.me/${m.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">{m.phone}</a>
                    </>
                  )}
                  {!m.mailSent && m.type !== "mdp" && " · mail non envoyé (clé Resend absente)"}
                </small>
                {m.body && <p className="lz-dem-message">{m.body}</p>}
                <div className="lz-archive-actions">
                  <form action={basculerMessage} data-ok="Message archivé.">
                    <input type="hidden" name="messageId" value={m.id} />
                    <button type="submit" className="lz-lien">Marquer comme traité (archiver)</button>
                  </form>
                  <form action={supprimerMessageSite} data-ok="Message supprimé.">
                    <input type="hidden" name="messageId" value={m.id} />
                    <ConfirmButton message="Supprimer définitivement ce message ?" className="lz-lien lz-danger">Supprimer</ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {voir("documents", docsRecus.length) && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="docs-title">
          <h2 id="docs-title" style={{ fontSize: 20 }}>
            Documents reçus des propriétaires <span className="muted" style={{ fontSize: 15 }}>(dernier mois)</span>
          </h2>
          {vue === "documents" && docsRecus.some((d) => !d.seenAt) && <MarquerDocumentsVus />}
          {docsRecus.length === 0 ? (
            <p className="muted">Aucun document envoyé par un propriétaire ce dernier mois.</p>
          ) : (
            <ul className="lz-liste-dem">
              {docsRecus.map((d) => (
                <li key={d.id}>
                  <div className="lz-dem-tete">
                    <strong>{d.owner.firstName} {d.owner.lastName} · {d.title}</strong>
                    {!d.seenAt && <span className="lz-statut lz-statut-nouvelle">Nouveau</span>}
                  </div>
                  <small className="lz-dem-meta">
                    <strong className="lz-date">{lastLogin.format(d.createdAt)}</strong> · {CATEGORIES_DOC[d.category]}{d.property ? ` · ${d.property.name}` : ""}
                  </small>
                  <div className="lz-archive-actions">
                    <a href={documentUrl(d.id)} target="_blank" rel="noopener" className="btn btn-outline btn-sm">Ouvrir</a>
                    <Link href={`/admin/clients/${d.owner.id}/documents`} className="lz-lien">Tous ses documents</Link>
                    <form action={supprimerDocument} data-ok="Document supprimé.">
                      <input type="hidden" name="documentId" value={d.id} />
                      <ConfirmButton message={`Supprimer « ${d.title} » ? Il disparaîtra aussi de l’espace du propriétaire.`} className="lz-lien lz-danger">Supprimer</ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {archives && (
        <section className="card card-pad stack" style={{ gap: 16 }} aria-labelledby="archives-title">
          <h2 id="archives-title" style={{ fontSize: 20 }}>Archives</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            Demandes traitées ou refusées, messages du site traités et conversations clôturées. « Supprimer » les efface définitivement, des deux côtés.
          </p>

          <h3 style={{ fontSize: 17 }}>Demandes des propriétaires ({demandesArch.length})</h3>
          {demandesArch.length === 0 ? <p className="muted">Aucune.</p> : (
            <ul className="lz-liste-dem">
              {demandesArch.map((r) => (
                <li key={r.id}>
                  <div className="lz-dem-tete">
                    <strong>{r.owner.firstName} {r.owner.lastName} · {TYPES_DEMANDE[r.type]}{r.property ? ` · ${r.property.name}` : ""}</strong>
                    <span className={`lz-statut ${r.status === "TRAITEE" ? "lz-statut-traitee" : "lz-statut-refusee"}`}>{STATUTS_DEMANDE[r.status]}</span>
                  </div>
                  <small className="lz-dem-meta">Envoyée le <strong className="lz-date">{lastLogin.format(r.createdAt)}</strong></small>
                  <p className="lz-dem-message">{r.message}</p>
                  {r.reply && <p className="lz-dem-message"><strong>Réponse :</strong> {r.reply}</p>}
                  <form action={supprimerDemande} className="lz-archive-actions" data-ok="Demande supprimée.">
                    <input type="hidden" name="demandeId" value={r.id} />
                    <Link href={`/admin/clients/${r.owner.id}/demandes`} className="lz-lien">Voir dans sa fiche</Link>
                    <ConfirmButton message="Supprimer définitivement cette demande (aussi chez le propriétaire) ?" className="lz-lien lz-danger">Supprimer</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ fontSize: 17 }}>Messages du site ({messagesArch.length})</h3>
          {messagesArch.length === 0 ? <p className="muted">Aucun.</p> : (
            <ul className="lz-liste-dem">
              {messagesArch.map((m) => (
                <li key={m.id}>
                  <div className="lz-dem-tete">
                    <strong>{m.type === "reservation" ? "Réservation" : m.type === "mdp" ? "Mot de passe oublié" : "Rappel"} · {m.name}{m.subject ? ` · ${m.subject}` : ""}</strong>
                    <span className="lz-statut lz-statut-traitee">Traité</span>
                  </div>
                  <small className="lz-dem-meta">
                    <strong className="lz-date">{lastLogin.format(m.createdAt)}</strong>{m.email && ` · ${m.email}`}{m.phone && ` · ${m.phone}`}
                  </small>
                  {m.body && <p className="lz-dem-message">{m.body}</p>}
                  <div className="lz-archive-actions">
                    <form action={basculerMessage} data-ok="Message remis à traiter.">
                      <input type="hidden" name="messageId" value={m.id} />
                      <button type="submit" className="lz-lien">Remettre à traiter</button>
                    </form>
                    <form action={supprimerMessageSite} data-ok="Message supprimé.">
                      <input type="hidden" name="messageId" value={m.id} />
                      <ConfirmButton message="Supprimer définitivement ce message ?" className="lz-lien lz-danger">Supprimer</ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ fontSize: 17 }}>Conversations clôturées ({conversationsArch.length})</h3>
          {conversationsArch.length === 0 ? <p className="muted">Aucune.</p> : (
            <ul className="lz-liste-dem">
              {conversationsArch.map((a) => (
                <li key={a.id}>
                  <div className="lz-dem-tete">
                    <strong>{a.owner.firstName} {a.owner.lastName} · {a.title}</strong>
                    <span className="lz-statut lz-statut-traitee">Clôturée</span>
                  </div>
                  <small className="lz-dem-meta">
                    Clôturée le <strong className="lz-date">{lastLogin.format(a.closedAt!)}</strong> · {a._count.replies} réponse{a._count.replies > 1 ? "s" : ""}
                  </small>
                  <form action={supprimerAvis} className="lz-archive-actions" data-ok="Conversation supprimée.">
                    <input type="hidden" name="avisId" value={a.id} />
                    <Link href={`/admin/clients/${a.owner.id}/messages`} className="lz-lien">Relire la conversation</Link>
                    <ConfirmButton message="Supprimer définitivement cette conversation (aussi chez le propriétaire) ?" className="lz-lien lz-danger">Supprimer</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
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
            placeholder="Nom, téléphone, bien…"
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
