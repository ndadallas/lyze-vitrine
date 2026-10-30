import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { addDays, formatMAD, formatShortDate, toDayString, today } from "@/lib/dates";
import { photoUrl } from "@/lib/photos";
import { nights } from "@/lib/stats";
import { ActionForm } from "@/components/ActionForm";
import { BookingRow } from "@/components/BookingRow";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EnteteBien } from "@/components/EnteteBien";
import { PhotoManager } from "@/components/PhotoManager";
import { Repli } from "@/components/Repli";
import {
  addBooking,
  addProperty,
  deleteOwner,
  deleteProperty,
  resetOwnerPassword,
  setOwnerActive,
  updateOwner,
  updateProperty,
} from "../../actions";

export const metadata: Metadata = { title: "Fiche client" };

const lastLogin = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Casablanca",
});

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export default async function ClientPage({ params, searchParams }: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  // Par défaut : 60 derniers jours + à venir ; ?historique=1 montre tout pour pouvoir corriger les anciennes lignes.
  const historique = sp.historique === "1";
  const since = addDays(today(), -60);

  const owner = await db.user.findUnique({
    where: { id },
    include: {
      properties: {
        orderBy: { createdAt: "asc" },
        include: {
          bookings: {
            where: historique ? undefined : { endDate: { gte: since } },
            orderBy: { startDate: "asc" },
          },
          photos: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } },
        },
      },
    },
  });
  if (!owner || owner.role !== "OWNER") notFound();

  // Bien affiché à droite : ?bien=<id>, ?bien=nouveau (formulaire d'ajout), sinon le premier.
  const ajout = sp.bien === "nouveau" || owner.properties.length === 0;
  const bien = ajout ? null : (owner.properties.find((p) => p.id === sp.bien) ?? owner.properties[0]);
  const base = `/admin/clients/${owner.id}`;
  const lien = (bienId: string, hist = historique) => `${base}?bien=${bienId}${hist ? "&historique=1" : ""}`;

  return (
    <>
      <div className="topbar">
        <div>
          <Link href="/admin" className="link">← Tous les clients</Link>
          <h1>
            {owner.firstName} {owner.lastName}
          </h1>
        </div>
        <span className={owner.active ? "pill pill-free" : "pill pill-blocked"}>
          {owner.active ? "Compte actif" : "Compte désactivé"}
        </span>
      </div>

      {/* ---------- Le client ---------- */}
      <section className="card card-pad stack" style={{ gap: 20 }} aria-label="Informations du client">
        <dl className="fiche-resume">
          <div><dt>Identifiant</dt><dd><code>{owner.username}</code></dd></div>
          <div><dt>WhatsApp</dt><dd>{owner.phone || "—"}</dd></div>
          <div><dt>Email</dt><dd>{owner.email || "—"}</dd></div>
          <div>
            <dt>Dernière connexion</dt>
            <dd>{owner.lastLoginAt ? lastLogin.format(owner.lastLoginAt) : "Jamais connecté"}</dd>
          </div>
        </dl>

        <div className="fiche-boutons">
          <Repli label="Modifier les infos du client">
            <ActionForm action={updateOwner} submitLabel="Enregistrer" className="form-grid">
              <input type="hidden" name="userId" value={owner.id} />
              <div className="field">
                <label htmlFor="firstName">Prénom</label>
                <input id="firstName" name="firstName" defaultValue={owner.firstName} required autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="lastName">Nom</label>
                <input id="lastName" name="lastName" defaultValue={owner.lastName} required autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="username">Identifiant de connexion</label>
                <input id="username" name="username" defaultValue={owner.username} required autoComplete="off" spellCheck={false} />
              </div>
              <div className="field">
                <label htmlFor="phone">WhatsApp</label>
                <input id="phone" name="phone" type="tel" defaultValue={owner.phone ?? ""} placeholder="06 12 34 56 78" autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" defaultValue={owner.email ?? ""} autoComplete="off" />
              </div>
            </ActionForm>
          </Repli>

          <Repli label="Mot de passe et accès">
            <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
              <div style={{ flex: "1 1 320px" }}>
                <ActionForm
                  action={resetOwnerPassword}
                  submitLabel="Créer un nouveau mot de passe"
                  submitClassName="btn btn-primary"
                  className="stack"
                  confirmMessage="Un nouveau mot de passe va être créé et l'ancien ne marchera plus. Continuer ?"
                >
                  <input type="hidden" name="userId" value={owner.id} />
                  <div className="field" style={{ maxWidth: 340 }}>
                    <label htmlFor="new-password">Mot de passe choisi (facultatif)</label>
                    <input
                      id="new-password"
                      name="password"
                      type="text"
                      minLength={8}
                      placeholder="Vide = généré automatiquement"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                </ActionForm>
              </div>
              <form action={setOwnerActive} className="stack" style={{ gap: 8, maxWidth: 280 }}>
                <input type="hidden" name="userId" value={owner.id} />
                <input type="hidden" name="active" value={owner.active ? "false" : "true"} />
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {owner.active
                    ? "Bloquer l'accès sans rien effacer (biens et photos sont gardés)."
                    : "Le client ne peut plus se connecter."}
                </p>
                {owner.active ? (
                  <ConfirmButton message="Le client ne pourra plus se connecter. Désactiver le compte ?" className="btn btn-danger">
                    Désactiver le compte
                  </ConfirmButton>
                ) : (
                  <button type="submit" className="btn btn-primary">Réactiver le compte</button>
                )}
              </form>
            </div>
          </Repli>
        </div>
      </section>

      {/* ---------- Ses biens, un par un ---------- */}
      <section className="stack" style={{ gap: 16 }} aria-labelledby="biens-title">
        <h2 id="biens-title" style={{ fontSize: 22 }}>
          Ses biens <span className="muted" style={{ fontSize: 16 }}>({owner.properties.length})</span>
        </h2>

        <div className="biens-admin">
          <nav className="biens-liste" aria-label="Biens du client">
            {owner.properties.map((p) => (
              <Link
                key={p.id}
                href={lien(p.id)}
                className="bien-onglet"
                aria-current={bien?.id === p.id ? "page" : undefined}
              >
                {p.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl(p.photos[0].id)} alt="" />
                ) : (
                  <span className="bien-onglet-vide" aria-hidden="true">{p.name.charAt(0)}</span>
                )}
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.city} · {pluriel(p.photos.length, "photo")}
                  </small>
                </span>
              </Link>
            ))}
            <Link
              href={`${base}?bien=nouveau`}
              className="bien-onglet bien-onglet-ajout"
              aria-current={ajout ? "page" : undefined}
            >
              <span className="bien-onglet-vide" aria-hidden="true">+</span>
              <span><strong>Ajouter un bien</strong></span>
            </Link>
          </nav>

          <div className="card bien-detail">
            {ajout || !bien ? (
              <div className="stack" style={{ gap: 18 }}>
                <h3 style={{ fontSize: 20 }}>Nouveau bien</h3>
                <p className="muted" style={{ fontSize: 14 }}>
                  Donnez un nom et une ville. Vous pourrez ensuite ajouter les photos et les réservations.
                </p>
                <ActionForm action={addProperty} submitLabel="Créer le bien" className="form-grid">
                  <input type="hidden" name="ownerId" value={owner.id} />
                  <div className="field">
                    <label htmlFor="prop-name">Nom du bien</label>
                    <input id="prop-name" name="name" placeholder="Appartement Vue Mer" required />
                  </div>
                  <div className="field">
                    <label htmlFor="prop-city">Ville</label>
                    <input id="prop-city" name="city" list="cities" placeholder="El Jadida" required />
                  </div>
                </ActionForm>
              </div>
            ) : (
              <>
                <EnteteBien
                  key={bien.id}
                  nom={bien.name}
                  ville={bien.city}
                  couverture={bien.photos[0] ? photoUrl(bien.photos[0].id) : null}
                  details={`${pluriel(bien.photos.length, "photo")} · ${pluriel(bien.bookings.length, "réservation")}${historique ? "" : " (récentes et à venir)"}`}
                  formulaire={
                    <ActionForm action={updateProperty} submitLabel="Enregistrer" className="form-grid">
                      {/* un seul enfant : évite l'avertissement de clés quand le formulaire passe en prop */}
                      <>
                        <input type="hidden" name="propertyId" value={bien.id} />
                        <div className="field">
                          <label htmlFor="edit-name">Nom du bien</label>
                          <input id="edit-name" name="name" defaultValue={bien.name} required />
                        </div>
                        <div className="field">
                          <label htmlFor="edit-city">Ville</label>
                          <input id="edit-city" name="city" list="cities" defaultValue={bien.city} required />
                        </div>
                      </>
                    </ActionForm>
                  }
                  suppression={
                    <form action={deleteProperty}>
                      <>
                        <input type="hidden" name="propertyId" value={bien.id} />
                        <ConfirmButton
                          message={`Supprimer « ${bien.name} » avec ses photos et toutes ses réservations ? C'est définitif.`}
                        >
                          Supprimer le bien
                        </ConfirmButton>
                      </>
                    </form>
                  }
                />

                <section className="bien-partie" aria-labelledby="photos-title">
                  <div className="bien-partie-tete">
                    <h4 id="photos-title">Photos</h4>
                    <p className="muted">
                      Glissez des images dans le cadre pour les ajouter. Cliquez sur une photo pour la voir en grand,
                      faites-la glisser pour changer l&apos;ordre (la première est la couverture).
                    </p>
                  </div>
                  <PhotoManager
                    key={bien.id}
                    propertyId={bien.id}
                    initial={bien.photos.map((ph) => ({ id: ph.id, url: photoUrl(ph.id) }))}
                  />
                </section>

                <section className="bien-partie" aria-labelledby="resas-title">
                  <div className="bien-partie-tete row-between">
                    <h4 id="resas-title">Réservations et blocages</h4>
                    <Link className="link" href={lien(bien.id, !historique)}>
                      {historique ? "Masquer les anciennes" : "Voir aussi les anciennes"}
                    </Link>
                  </div>

                  <Repli key={`ajout-${bien.id}`} label="+ Ajouter une réservation ou un blocage" buttonClassName="btn btn-primary btn-sm">
                    <ActionForm action={addBooking} submitLabel="Ajouter" className="form-grid">
                      <input type="hidden" name="propertyId" value={bien.id} />
                      <div className="field">
                        <label htmlFor="add-kind">Type</label>
                        <select id="add-kind" name="kind" defaultValue="RESERVED">
                          <option value="RESERVED">Réservation</option>
                          <option value="BLOCKED">Blocage (travaux, usage perso…)</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="add-start">Arrivée</label>
                        <input id="add-start" name="startDate" type="date" required />
                      </div>
                      <div className="field">
                        <label htmlFor="add-end">Départ</label>
                        <input id="add-end" name="endDate" type="date" required />
                      </div>
                      <div className="field">
                        <label htmlFor="add-guest">Voyageur</label>
                        <input id="add-guest" name="guestName" placeholder="Seule l'initiale est montrée au client" />
                      </div>
                      <div className="field">
                        <label htmlFor="add-amount">Montant net (MAD)</label>
                        <input id="add-amount" name="amount" type="number" min="0" step="1" inputMode="numeric" />
                      </div>
                      <div className="field">
                        <label htmlFor="add-note">Motif (blocage)</label>
                        <input id="add-note" name="note" placeholder="ex. entretien" />
                      </div>
                    </ActionForm>
                  </Repli>

                  {bien.bookings.length > 0 ? (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Type</th>
                            <th scope="col">Dates</th>
                            <th scope="col">Nuits</th>
                            <th scope="col">Voyageur / motif</th>
                            <th scope="col">Montant net</th>
                            <th scope="col"><span className="sr-only">Actions</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {bien.bookings.map((b) => (
                            <BookingRow
                              key={b.id}
                              b={{
                                id: b.id,
                                kind: b.kind,
                                startDate: toDayString(b.startDate),
                                endDate: toDayString(b.endDate),
                                guestName: b.guestName,
                                amount: b.amount,
                                note: b.note,
                                datesLabel: `${formatShortDate(b.startDate)} → ${formatShortDate(b.endDate)}`,
                                nights: nights(b),
                                amountLabel: b.kind === "RESERVED" ? formatMAD(b.amount) : "—",
                              }}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 14 }}>
                      {historique ? "Aucune réservation pour ce bien." : "Aucune réservation récente ni à venir pour ce bien."}
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
        <datalist id="cities">
          <option value="El Jadida" />
          <option value="Casablanca" />
          <option value="Marrakech" />
        </datalist>
      </section>

      <section className="card card-pad row-between zone-danger" style={{ gap: 20, flexWrap: "wrap" }} aria-labelledby="delete-title">
        <div>
          <h2 id="delete-title" style={{ fontSize: 18 }}>Supprimer ce client</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>
            Ses biens, photos, réservations et accès sont effacés définitivement. Pour simplement bloquer
            l&apos;accès, utilisez « Mot de passe et accès » → Désactiver le compte.
          </p>
        </div>
        <form action={deleteOwner}>
          <input type="hidden" name="userId" value={owner.id} />
          <ConfirmButton
            message={`Supprimer définitivement ${owner.firstName} ${owner.lastName}, ses biens, photos et réservations ? Cette action est irréversible.`}
            className="btn btn-danger"
          >
            Supprimer le client
          </ConfirmButton>
        </form>
      </section>
    </>
  );
}
