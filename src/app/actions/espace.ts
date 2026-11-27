"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireOwner } from "@/lib/auth";
import { parseDay, today } from "@/lib/dates";
import { CODES_DEPENSES, CODES_STATUTS, CODES_TYPES_DEMANDE, ELECTROMENAGER, EQUIPEMENTS, TYPES_BIEN } from "@/lib/espace";
import { findClash, parseBooking } from "@/lib/reservations";
import { getEditableProperty } from "@/lib/photos";
import { getSessionUser } from "@/lib/session";

export type EspaceState = { error?: string; ok?: number } | undefined;

const premier = (e: z.ZodError) => e.issues[0]?.message ?? "Formulaire invalide.";
const texte = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères maximum.` })
    .transform((v) => v || null);
const entier = (max: number, nom: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number({ error: `${nom} : nombre invalide.` }).int().min(0).max(max).nullable());

function rafraichir(ownerId: string) {
  revalidatePath("/espace", "layout");
  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${ownerId}`, "layout");
}

/* ------------------------------------------------------------------ */
/* Fiche du bien (propriétaire ou gérante)                             */
/* ------------------------------------------------------------------ */

const FicheSchema = z.object({
  name: z.string().trim().min(1, { error: "Nom du bien requis." }).max(120),
  city: z.string().trim().min(1, { error: "Ville requise." }).max(80),
  kind: z.union([z.enum(TYPES_BIEN), z.literal("")]).transform((v) => v || null),
  address: texte(300),
  bedrooms: entier(50, "Chambres"),
  capacity: entier(100, "Voyageurs"),
  surface: entier(10000, "Surface"),
  equipment: z.array(z.enum([...EQUIPEMENTS, ...ELECTROMENAGER])),
  wifiName: texte(100),
  wifiPassword: texte(100),
  arrival: texte(2000),
  notes: texte(2000),
  description: texte(2000),
  price: entier(1_000_000, "Prix"),
});

export async function enregistrerFiche(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  const bien = await getEditableProperty(String(formData.get("propertyId") ?? ""));
  if (!bien) return { error: "Accès refusé." };

  const parsed = FicheSchema.safeParse({
    name: formData.get("name") ?? "",
    city: formData.get("city") ?? "",
    kind: formData.get("kind") ?? "",
    address: formData.get("address") ?? "",
    bedrooms: formData.get("bedrooms") ?? "",
    capacity: formData.get("capacity") ?? "",
    surface: formData.get("surface") ?? "",
    equipment: formData.getAll("equipment").map(String),
    wifiName: formData.get("wifiName") ?? "",
    wifiPassword: formData.get("wifiPassword") ?? "",
    arrival: formData.get("arrival") ?? "",
    notes: formData.get("notes") ?? "",
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? "",
  });
  if (!parsed.success) return { error: premier(parsed.error) };

  await db.property.update({ where: { id: bien.id }, data: parsed.data });
  rafraichir(bien.ownerId);
  return { ok: Date.now() };
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

/** Gérante : tout document ; propriétaire : seulement ceux qu'il a envoyés (2026-11-22). */
export async function supprimerDocument(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const doc = await db.document.findUnique({
    where: { id: String(formData.get("documentId") ?? "") },
    select: { id: true, ownerId: true, byAdmin: true },
  });
  if (!doc) return;
  if (user.role !== "ADMIN" && (doc.ownerId !== user.id || doc.byAdmin)) return;
  await db.document.delete({ where: { id: doc.id } });
  rafraichir(doc.ownerId);
}

/* ------------------------------------------------------------------ */
/* Demandes du propriétaire                                            */
/* ------------------------------------------------------------------ */

const DemandeSchema = z
  .object({
    type: z.enum(CODES_TYPES_DEMANDE, { error: "Choisissez le type de demande." }),
    propertyId: z.string().transform((v) => v || null),
    du: z.string().transform((v) => (v ? parseDay(v) : null)),
    au: z.string().transform((v) => (v ? parseDay(v) : null)),
    message: z.string().trim().max(2000, { error: "Message trop long (2000 caractères maximum)." }),
  })
  .superRefine((d, ctx) => {
    if (d.type === "USAGE_PERSO") {
      if (!d.propertyId) ctx.addIssue({ code: "custom", message: "Choisissez le bien concerné." });
      if (!d.du || !d.au) ctx.addIssue({ code: "custom", message: "Indiquez les dates d'arrivée et de départ." });
      else if (d.au <= d.du) ctx.addIssue({ code: "custom", message: "Le départ doit être après l'arrivée." });
      else if (d.du < today()) ctx.addIssue({ code: "custom", message: "Les dates sont déjà passées." });
    } else if (d.message.length < 5) {
      ctx.addIssue({ code: "custom", message: "Décrivez votre demande en quelques mots." });
    }
  });

export async function envoyerDemande(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  const user = await requireOwner();
  const parsed = DemandeSchema.safeParse({
    type: formData.get("type") ?? "",
    propertyId: String(formData.get("propertyId") ?? ""),
    du: String(formData.get("du") ?? ""),
    au: String(formData.get("au") ?? ""),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) return { error: premier(parsed.error) };
  const d = parsed.data;

  if (d.propertyId) {
    const bien = await db.property.findFirst({ where: { id: d.propertyId, ownerId: user.id }, select: { id: true } });
    if (!bien) return { error: "Bien introuvable." };
  }
  const enCours = await db.ownerRequest.count({ where: { ownerId: user.id, status: "NOUVELLE" } });
  if (enCours >= 20) return { error: "Vous avez déjà 20 demandes en attente. Lyze vous répond au plus vite." };

  await db.ownerRequest.create({
    data: {
      ownerId: user.id,
      propertyId: d.propertyId,
      type: d.type,
      startDate: d.type === "USAGE_PERSO" ? d.du : null,
      endDate: d.type === "USAGE_PERSO" ? d.au : null,
      message: d.message || "Usage personnel",
    },
  });
  rafraichir(user.id);
  return { ok: Date.now() };
}

/**
 * Le propriétaire supprime une demande : pas encore prise en charge = supprimée pour de bon,
 * sinon seulement retirée de son espace (Lyze garde l'historique).
 */
export async function annulerDemande(formData: FormData) {
  const user = await requireOwner();
  const where = { id: String(formData.get("demandeId") ?? ""), ownerId: user.id };
  await db.ownerRequest.deleteMany({ where: { ...where, status: "NOUVELLE" } });
  await db.ownerRequest.updateMany({ where, data: { hiddenByOwner: true } });
  rafraichir(user.id);
}

/* ------------------------------------------------------------------ */
/* Traitement par la gérante                                           */
/* ------------------------------------------------------------------ */

const TraitementSchema = z.object({
  status: z.enum(CODES_STATUTS),
  reply: texte(2000),
  bloquer: z.boolean(),
});

export async function traiterDemande(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  await requireAdmin();
  const demande = await db.ownerRequest.findUnique({ where: { id: String(formData.get("demandeId") ?? "") } });
  if (!demande) return { error: "Demande introuvable." };

  const parsed = TraitementSchema.safeParse({
    status: formData.get("status") ?? "",
    reply: formData.get("reply") ?? "",
    bloquer: formData.get("bloquer") === "on",
  });
  if (!parsed.success) return { error: premier(parsed.error) };
  const t = parsed.data;

  // Accepter (case cochée OU statut « Traitée ») : les dates demandées deviennent un blocage, une seule fois.
  const accepte = (t.bloquer || t.status === "TRAITEE") && demande.status !== "TRAITEE";
  if (accepte && demande.type === "USAGE_PERSO" && demande.propertyId && demande.startDate && demande.endDate) {
    const conflit = await db.booking.findFirst({
      where: {
        propertyId: demande.propertyId,
        kind: "RESERVED",
        startDate: { lt: demande.endDate },
        endDate: { gt: demande.startDate },
      },
      select: { id: true },
    });
    if (conflit) return { error: "Une réservation voyageur existe déjà sur ces dates : impossible de les bloquer." };
    await db.booking.create({
      data: {
        propertyId: demande.propertyId,
        kind: "BLOCKED",
        startDate: demande.startDate,
        endDate: demande.endDate,
        note: "Usage personnel du propriétaire",
      },
    });
  }

  await db.ownerRequest.update({
    where: { id: demande.id },
    data: { status: accepte ? "TRAITEE" : t.status, reply: t.reply },
  });
  rafraichir(demande.ownerId);
  return { ok: Date.now() };
}

/* ------------------------------------------------------------------ */
/* Biens (le propriétaire ajoute, renomme, supprime les siens)         */
/* ------------------------------------------------------------------ */

const BienSchema = z.object({
  name: z.string().trim().min(1, { error: "Nom du bien requis." }).max(120),
  city: z.string().trim().min(1, { error: "Ville requise." }).max(80),
});

/** La gérante ajoute un bien à un client (vue client de l'admin) ; le propriétaire ne peut plus en créer. */
export async function ajouterBien(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  await requireAdmin();
  const user = await db.user.findFirst({ where: { id: String(formData.get("ownerId") ?? ""), role: "OWNER" }, select: { id: true } });
  if (!user) return { error: "Client introuvable." };
  const parsed = BienSchema.safeParse({ name: formData.get("name") ?? "", city: formData.get("city") ?? "" });
  if (!parsed.success) return { error: premier(parsed.error) };
  if ((await db.property.count({ where: { ownerId: user.id } })) >= 50) return { error: "Maximum 50 biens par compte." };
  await db.property.create({ data: { ...parsed.data, ownerId: user.id } });
  rafraichir(user.id);
  return { ok: Date.now() };
}

export async function supprimerBien(formData: FormData) {
  const bien = await getEditableProperty(String(formData.get("propertyId") ?? ""));
  if (!bien) return;
  await db.property.delete({ where: { id: bien.id } });
  rafraichir(bien.ownerId);
}

/** Bouton « Afficher ce bien sur le site » / « Retirer du site » (même champ que la case de la fiche). */
export async function basculerPublication(formData: FormData) {
  const bien = await getEditableProperty(String(formData.get("propertyId") ?? ""));
  if (!bien) return;
  await db.property.update({ where: { id: bien.id }, data: { published: !bien.published } });
  rafraichir(bien.ownerId);
}

/* ------------------------------------------------------------------ */
/* Calendrier : réservations et blocages saisis depuis l'espace        */
/* ------------------------------------------------------------------ */

/** Ajoute (sans bookingId) ou modifie (avec bookingId) une ligne du calendrier d'un bien. */
export async function enregistrerResa(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const existante = bookingId ? await db.booking.findUnique({ where: { id: bookingId } }) : null;
  if (bookingId && !existante) return { error: "Réservation introuvable." };
  if (existante) formData.set("propertyId", existante.propertyId);

  const bien = await getEditableProperty(String(formData.get("propertyId") ?? ""));
  if (!bien) return { error: "Accès refusé." };

  const parsed = parseBooking(formData);
  if (!parsed.success) return { error: premier(parsed.error) };
  const b = parsed.data;

  const clash = await findClash(bien.id, b.startDate, b.endDate, existante?.id);
  if (clash) return { error: clash };

  const data = {
    kind: b.kind,
    platform: b.platform,
    platformOther: b.platform === "OTHER" ? b.platformOther : null,
    startDate: b.startDate,
    endDate: b.endDate,
    // le propriétaire ne voit que l'initiale : champ vide = nom inchangé
    guestName: b.guestName ?? existante?.guestName ?? null,
    amount: b.kind === "RESERVED" ? b.amount : 0,
    ...{ nightPrice: b.kind === "RESERVED" ? b.nightPrice : 0, fees: b.kind === "RESERVED" ? b.fees : 0, commission: b.kind === "RESERVED" ? b.commission : 0 },
    note: b.note,
    // saisi par le propriétaire = à valider par la gérante ; saisi par la gérante = validé
    pending: (await getSessionUser())?.role !== "ADMIN",
  };
  if (existante) await db.booking.update({ where: { id: existante.id }, data });
  else await db.booking.create({ data: { ...data, propertyId: bien.id } });
  rafraichir(bien.ownerId);
  return { ok: Date.now() };
}

export async function supprimerResa(formData: FormData) {
  const resa = await db.booking.findUnique({ where: { id: String(formData.get("bookingId") ?? "") } });
  if (!resa || !(await getEditableProperty(resa.propertyId))) return;
  await db.booking.delete({ where: { id: resa.id } });
  const bien = await db.property.findUnique({ where: { id: resa.propertyId }, select: { ownerId: true } });
  if (bien) rafraichir(bien.ownerId);
}

/* ------------------------------------------------------------------ */
/* Dépenses                                                            */
/* ------------------------------------------------------------------ */

const DepenseSchema = z.object({
  date: z.string().transform((v, ctx) => {
    const d = parseDay(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
    return d ?? new Date(NaN);
  }),
  category: z.enum(CODES_DEPENSES, { error: "Catégorie invalide." }),
  label: z.string().trim().min(1, { error: "Indiquez un libellé." }).max(120),
  amount: z.coerce
    .number({ error: "Montant invalide." })
    .int({ error: "Montant en DH, sans centimes." })
    .min(1, { error: "Montant invalide." })
    .max(10_000_000),
});

export async function ajouterDepense(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  const user = await getSessionUser();
  const bien = await getEditableProperty(String(formData.get("propertyId") ?? ""));
  if (!user || !bien) return { error: "Accès refusé." };
  const parsed = DepenseSchema.safeParse({
    date: formData.get("date") ?? "",
    category: formData.get("category") ?? "",
    label: formData.get("label") ?? "",
    amount: formData.get("amount") ?? "",
  });
  if (!parsed.success) return { error: premier(parsed.error) };
  await db.expense.create({ data: { ...parsed.data, propertyId: bien.id, byOwner: user.role === "OWNER" } });
  rafraichir(bien.ownerId);
  return { ok: Date.now() };
}

/** Modifie une dépense (mêmes droits que la suppression ; le bien ne change pas). */
export async function modifierDepense(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  const dep = await db.expense.findUnique({ where: { id: String(formData.get("expenseId") ?? "") } });
  const bien = dep ? await getEditableProperty(dep.propertyId) : null;
  if (!dep || !bien) return { error: "Accès refusé." };
  const parsed = DepenseSchema.safeParse({
    date: formData.get("date") ?? "",
    category: formData.get("category") ?? "",
    label: formData.get("label") ?? "",
    amount: formData.get("amount") ?? "",
  });
  if (!parsed.success) return { error: premier(parsed.error) };
  await db.expense.update({ where: { id: dep.id }, data: parsed.data });
  rafraichir(bien.ownerId);
  return { ok: Date.now() };
}

export async function supprimerDepense(formData: FormData) {
  const dep = await db.expense.findUnique({ where: { id: String(formData.get("expenseId") ?? "") } });
  const bien = dep ? await getEditableProperty(dep.propertyId) : null;
  if (!dep || !bien) return;
  await db.expense.delete({ where: { id: dep.id } });
  rafraichir(bien.ownerId);
}

/* ------------------------------------------------------------------ */
/* Messages des formulaires du site (admin)                            */
/* ------------------------------------------------------------------ */

export async function basculerMessage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("messageId") ?? "");
  const m = await db.siteMessage.findUnique({ where: { id }, select: { handled: true } });
  if (!m) return;
  await db.siteMessage.update({ where: { id }, data: { handled: !m.handled } });
  revalidatePath("/admin");
}

/* ------------------------------------------------------------------ */
/* Validation par la gérante des lignes saisies par le propriétaire     */
/* ------------------------------------------------------------------ */

export async function validerResa(formData: FormData) {
  await requireAdmin();
  const resa = await db.booking
    .update({ where: { id: String(formData.get("bookingId") ?? "") }, data: { pending: false }, include: { property: { select: { ownerId: true } } } })
    .catch(() => null);
  if (resa) rafraichir(resa.property.ownerId);
}

export async function refuserResa(formData: FormData) {
  await requireAdmin();
  const resa = await db.booking
    .delete({ where: { id: String(formData.get("bookingId") ?? "") }, include: { property: { select: { ownerId: true } } } })
    .catch(() => null);
  if (resa) rafraichir(resa.property.ownerId);
}

/* ------------------------------------------------------------------ */
/* Messages de Lyze aux propriétaires (fuite, panne, intervention…)    */
/* ------------------------------------------------------------------ */

const AvisSchema = z.object({
  ownerId: z.string().min(1),
  propertyId: z.string().transform((v) => v || null),
  title: z.string().trim().min(3, { error: "Donnez un objet au message." }).max(120, { error: "Objet trop long." }),
  message: z.string().trim().min(5, { error: "Écrivez le message." }).max(3000, { error: "Message trop long (3000 caractères maximum)." }),
  eventDate: z.string().transform((v) => (v ? parseDay(v) : null)),
});

export async function envoyerAvis(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  await requireAdmin();
  const parsed = AvisSchema.safeParse({
    ownerId: String(formData.get("ownerId") ?? ""),
    propertyId: String(formData.get("propertyId") ?? ""),
    title: String(formData.get("title") ?? ""),
    message: String(formData.get("message") ?? ""),
    eventDate: String(formData.get("eventDate") ?? ""),
  });
  if (!parsed.success) return { error: premier(parsed.error) };
  const d = parsed.data;

  const owner = await db.user.findFirst({ where: { id: d.ownerId, role: "OWNER" }, select: { id: true } });
  if (!owner) return { error: "Client introuvable." };
  if (d.propertyId) {
    const bien = await db.property.findFirst({ where: { id: d.propertyId, ownerId: owner.id }, select: { id: true } });
    if (!bien) return { error: "Bien introuvable." };
  }
  await db.ownerNotice.create({ data: d });
  rafraichir(owner.id);
  return { ok: Date.now() };
}

export async function supprimerAvis(formData: FormData) {
  await requireAdmin();
  const avis = await db.ownerNotice.findUnique({ where: { id: String(formData.get("avisId") ?? "") }, select: { id: true, ownerId: true } });
  if (!avis) return;
  await db.ownerNotice.delete({ where: { id: avis.id } });
  rafraichir(avis.ownerId);
}

/** Le propriétaire supprime un message de son espace (Lyze le garde ; une nouvelle réponse de Lyze le fait réapparaître). */
export async function masquerAvis(formData: FormData) {
  const user = await requireOwner();
  await db.ownerNotice.updateMany({ where: { id: String(formData.get("avisId") ?? ""), ownerId: user.id }, data: { hiddenByOwner: true } });
  rafraichir(user.id);
}

/** Gérante : supprime une réponse d'un propriétaire. */
export async function supprimerReponse(formData: FormData) {
  await requireAdmin();
  const r = await db.noticeReply.findUnique({ where: { id: String(formData.get("reponseId") ?? "") }, select: { id: true, notice: { select: { ownerId: true } } } });
  if (!r) return;
  await db.noticeReply.delete({ where: { id: r.id } });
  rafraichir(r.notice.ownerId);
}

/** Gérante : documents envoyés par les propriétaires (un client ou tous) marqués vus → plus de pastille. */
export async function marquerDocumentsVus(ownerId?: string) {
  await requireAdmin();
  const n = await db.document.updateMany({ where: { byAdmin: false, seenAt: null, ...(ownerId ? { ownerId } : {}) }, data: { seenAt: new Date() } });
  if (n.count) revalidatePath("/admin", "layout");
}

/** Le propriétaire ouvre l'onglet Messages : tout devient lu (la gérante voit « Lu le … »), réponses de Lyze comprises. */
export async function marquerAvisLus() {
  const user = await requireOwner();
  const maintenant = new Date();
  const [avis, reponses] = await db.$transaction([
    db.ownerNotice.updateMany({ where: { ownerId: user.id, readAt: null }, data: { readAt: maintenant } }),
    db.noticeReply.updateMany({ where: { fromAdmin: true, readAt: null, notice: { ownerId: user.id } }, data: { readAt: maintenant } }),
  ]);
  if (avis.count || reponses.count) rafraichir(user.id);
}

/** La gérante ouvre les messages d'un client : ses réponses deviennent lues. */
export async function marquerReponsesLues(ownerId: string) {
  await requireAdmin();
  const { count } = await db.noticeReply.updateMany({
    where: { fromAdmin: false, readAt: null, notice: { ownerId } },
    data: { readAt: new Date() },
  });
  if (count) rafraichir(ownerId);
}

const ReponseSchema = z.object({
  noticeId: z.string().min(1),
  body: z.string().trim().min(1, { error: "Écrivez votre réponse." }).max(3000, { error: "Réponse trop longue (3000 caractères maximum)." }),
});

/** Répondre dans le fil d'un message, comme à un mail : la gérante ou le propriétaire concerné. */
export async function repondreAvis(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  const user = await getSessionUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  // « Clôturer » (gérante seulement, demande 2026-11-22) : réponse facultative, puis le propriétaire ne peut plus répondre
  const cloturer = user.role === "ADMIN" && formData.get("cloturer") === "1";
  const body = String(formData.get("body") ?? "");
  const parsed = ReponseSchema.safeParse({ noticeId: String(formData.get("noticeId") ?? ""), body: cloturer && !body.trim() ? "-" : body });
  if (!parsed.success) return { error: premier(parsed.error) };

  const avis = await db.ownerNotice.findUnique({ where: { id: parsed.data.noticeId }, select: { id: true, ownerId: true, closedAt: true } });
  // un propriétaire ne répond qu'à ses propres messages, et plus du tout une fois la conversation clôturée
  if (!avis || (user.role !== "ADMIN" && avis.ownerId !== user.id)) return { error: "Message introuvable." };
  if (user.role !== "ADMIN" && avis.closedAt) return { error: "Cette conversation a été clôturée par Lyze." };

  if (body.trim()) await db.noticeReply.create({ data: { noticeId: avis.id, fromAdmin: user.role === "ADMIN", body: parsed.data.body } });
  // la gérante qui répond sans clôturer rouvre la conversation
  if (user.role === "ADMIN") await db.ownerNotice.update({ where: { id: avis.id }, data: { closedAt: cloturer ? new Date() : null, hiddenByOwner: false } });
  rafraichir(avis.ownerId);
  return { ok: Date.now() };
}

/* ------------------------------------------------------------------ */
/* Archives de la gérante (2026-11-22) : suppression définitive          */
/* ------------------------------------------------------------------ */

export async function supprimerDemande(formData: FormData) {
  await requireAdmin();
  const d = await db.ownerRequest.findUnique({ where: { id: String(formData.get("demandeId") ?? "") }, select: { id: true, ownerId: true } });
  if (!d) return;
  await db.ownerRequest.delete({ where: { id: d.id } });
  rafraichir(d.ownerId);
}

export async function supprimerMessageSite(formData: FormData) {
  await requireAdmin();
  await db.siteMessage.deleteMany({ where: { id: String(formData.get("messageId") ?? "") } });
  revalidatePath("/admin");
}
