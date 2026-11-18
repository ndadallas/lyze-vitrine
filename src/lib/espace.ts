// Libellés partagés entre l'espace propriétaire et l'admin (fiche du bien, documents, demandes).

export const TYPES_BIEN = ["Appartement", "Studio", "Villa", "Riad", "Maison", "Duplex"] as const;

export const EQUIPEMENTS = [
  "Wifi",
  "Climatisation",
  "Chauffage",
  "Cuisine équipée",
  "Lave-linge",
  "Télévision",
  "Piscine",
  "Terrasse ou balcon",
  "Vue mer",
  "Parking",
  "Ascenseur",
  "Barbecue",
] as const;

export const CATEGORIES_DOC = {
  CONTRAT: "Contrat de gestion",
  RELEVE: "Relevé de revenus",
  FACTURE: "Facture",
  ETAT_DES_LIEUX: "État des lieux",
  ASSURANCE: "Assurance",
  IDENTITE: "Pièce d'identité / titre de propriété",
  AUTRE: "Autre",
} as const;
export type CategorieDoc = keyof typeof CATEGORIES_DOC;
export const CODES_CATEGORIES = Object.keys(CATEGORIES_DOC) as [CategorieDoc, ...CategorieDoc[]];

export const TYPES_DEMANDE = {
  USAGE_PERSO: "Bloquer des dates pour moi",
  MENAGE: "Ménage ou linge",
  MAINTENANCE: "Panne ou réparation",
  QUESTION: "Question à Lyze",
} as const;
export type TypeDemande = keyof typeof TYPES_DEMANDE;
export const CODES_TYPES_DEMANDE = Object.keys(TYPES_DEMANDE) as [TypeDemande, ...TypeDemande[]];

export const STATUTS_DEMANDE = {
  NOUVELLE: "Envoyée",
  EN_COURS: "En cours",
  TRAITEE: "Traitée",
  REFUSEE: "Refusée",
} as const;
export type StatutDemande = keyof typeof STATUTS_DEMANDE;
export const CODES_STATUTS = Object.keys(STATUTS_DEMANDE) as [StatutDemande, ...StatutDemande[]];

export const MAX_DOC_BYTES = 4 * 1024 * 1024; // limite d'une requête Vercel (4,5 Mo)
export const MAX_DOCS_PAR_CLIENT = 100;

export const documentUrl = (id: string) => `/api/documents/${id}`;

export function tailleFichier(octets: number) {
  return octets < 1024 * 1024
    ? `${Math.max(1, Math.round(octets / 1024))} Ko`
    : `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

/** Forme envoyée au navigateur pour la fiche d'un bien. */
export type FicheBien = {
  name: string;
  city: string;
  kind: string;
  address: string;
  bedrooms: number | null;
  capacity: number | null;
  surface: number | null;
  equipment: string[];
  wifiName: string;
  wifiPassword: string;
  arrival: string;
  notes: string;
  published: boolean;
  description: string;
  price: number | null;
};

export const ficheDepuis = (p: {
  name: string;
  city: string;
  kind: string | null;
  address: string | null;
  bedrooms: number | null;
  capacity: number | null;
  surface: number | null;
  equipment: string[];
  wifiName: string | null;
  wifiPassword: string | null;
  arrival: string | null;
  notes: string | null;
  published: boolean;
  description: string | null;
  price: number | null;
}): FicheBien => ({
  name: p.name,
  city: p.city,
  kind: p.kind ?? "",
  address: p.address ?? "",
  bedrooms: p.bedrooms,
  capacity: p.capacity,
  surface: p.surface,
  equipment: p.equipment,
  wifiName: p.wifiName ?? "",
  wifiPassword: p.wifiPassword ?? "",
  arrival: p.arrival ?? "",
  notes: p.notes ?? "",
  published: p.published,
  description: p.description ?? "",
  price: p.price,
});

export type DocumentItem = {
  id: string;
  titre: string;
  categorie: CategorieDoc;
  bien: string | null; // nom du bien, null = tout le compte
  date: string; // "2026-11-16"
  taille: number;
  mime: string;
  parLyze: boolean;
};

export type DemandeItem = {
  id: string;
  type: TypeDemande;
  statut: StatutDemande;
  bien: string | null;
  du: string | null;
  au: string | null; // départ exclu, comme les réservations
  message: string;
  reponse: string | null;
  date: string;
};

/* Conversion des lignes de la base vers les formes envoyées au navigateur (espace et admin). */
const jourIso = (d: Date) => d.toISOString().slice(0, 10);
// formatée côté serveur seulement : le fuseau du Maroc diffère parfois entre Node et le navigateur (erreur d’hydratation)
const quandReponse = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });

export function versDocumentItem(d: {
  id: string;
  title: string;
  category: CategorieDoc;
  property: { name: string } | null;
  createdAt: Date;
  size: number;
  mimeType: string;
  byAdmin: boolean;
}): DocumentItem {
  return {
    id: d.id,
    titre: d.title,
    categorie: d.category,
    bien: d.property?.name ?? null,
    date: jourIso(d.createdAt),
    taille: d.size,
    mime: d.mimeType,
    parLyze: d.byAdmin,
  };
}

export function versDemandeItem(r: {
  id: string;
  type: TypeDemande;
  status: StatutDemande;
  property: { name: string } | null;
  startDate: Date | null;
  endDate: Date | null;
  message: string;
  reply: string | null;
  createdAt: Date;
}): DemandeItem {
  return {
    id: r.id,
    type: r.type,
    statut: r.status,
    bien: r.property?.name ?? null,
    du: r.startDate ? jourIso(r.startDate) : null,
    au: r.endDate ? jourIso(r.endDate) : null,
    message: r.message,
    reponse: r.reply,
    date: jourIso(r.createdAt),
  };
}

/** Sélection Prisma commune (sans le contenu du fichier). */
export const SELECT_DOCUMENT = {
  id: true,
  title: true,
  category: true,
  property: { select: { name: true } },
  createdAt: true,
  size: true,
  mimeType: true,
  byAdmin: true,
} as const;

/* Dépenses par bien */
export const CATEGORIES_DEPENSE = {
  MENAGE: "Ménage",
  LINGE: "Linge et blanchisserie",
  ENTRETIEN: "Entretien et réparations",
  EQUIPEMENT: "Équipement et mobilier",
  CHARGES: "Charges (eau, électricité, internet, syndic)",
  TAXES: "Taxes et impôts",
  AUTRE: "Autre",
} as const;
export type CategorieDepense = keyof typeof CATEGORIES_DEPENSE;
export const CODES_DEPENSES = Object.keys(CATEGORIES_DEPENSE) as [CategorieDepense, ...CategorieDepense[]];

export type DepenseItem = {
  id: string;
  bienId: string;
  date: string; // "2026-11-16"
  categorie: CategorieDepense;
  libelle: string;
  montant: number;
  parProprio: boolean;
};

export const versDepenseItem = (e: {
  id: string;
  propertyId: string;
  date: Date;
  category: CategorieDepense;
  label: string;
  amount: number;
  byOwner: boolean;
}): DepenseItem => ({
  id: e.id,
  bienId: e.propertyId,
  date: jourIso(e.date),
  categorie: e.category,
  libelle: e.label,
  montant: e.amount,
  parProprio: e.byOwner,
});

/** Message de Lyze à un propriétaire, tel qu'envoyé au navigateur. */
export type AvisItem = {
  id: string;
  titre: string;
  message: string;
  bien: string | null;
  intervention: string | null; // "2026-11-20"
  date: string;
  lu: string | null;
  /** Fil de réponses, du plus ancien au plus récent (date déjà formatée : « 18 nov., 21:29 ») */
  reponses: { id: string; deLyze: boolean; texte: string; date: string; lu: boolean }[];
};

/** Requête Prisma : un message avec son bien et ses réponses dans l'ordre. */
export const INCLURE_AVIS = {
  property: { select: { name: true } },
  replies: { orderBy: { createdAt: "asc" as const } },
};

export function versAvisItem(a: {
  id: string;
  title: string;
  message: string;
  property: { name: string } | null;
  eventDate: Date | null;
  readAt: Date | null;
  createdAt: Date;
  replies?: { id: string; fromAdmin: boolean; body: string; createdAt: Date; readAt: Date | null }[];
}): AvisItem {
  return {
    id: a.id,
    titre: a.title,
    message: a.message,
    bien: a.property?.name ?? null,
    intervention: a.eventDate ? jourIso(a.eventDate) : null,
    date: jourIso(a.createdAt),
    lu: a.readAt ? jourIso(a.readAt) : null,
    reponses: (a.replies ?? []).map((r) => ({
      id: r.id,
      deLyze: r.fromAdmin,
      texte: r.body,
      date: quandReponse.format(r.createdAt),
      lu: !!r.readAt,
    })),
  };
}
