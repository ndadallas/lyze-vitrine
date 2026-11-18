// Plateformes d'origine des réservations : libellé + logo (fichiers dans public/assets/img/plateformes).
export const PLATEFORMES = {
  AIRBNB: { nom: "Airbnb", logo: "/assets/img/plateformes/airbnb.svg" },
  BOOKING: { nom: "Booking", logo: "/assets/img/plateformes/booking.svg" },
  EXPEDIA: { nom: "Expedia", logo: "/assets/img/plateformes/expedia.svg" },
  DIRECT: { nom: "Direct", logo: "/assets/img/plateformes/direct.svg" },
  OTHER: { nom: "Autre", logo: null },
  LYZE: { nom: "Lyze", logo: "/assets/img/plateformes/lyze.svg" },
} as const;

export type Plateforme = keyof typeof PLATEFORMES;
export const CODES_PLATEFORMES = Object.keys(PLATEFORMES) as [Plateforme, ...Plateforme[]];

/** Petit logo + nom de la plateforme ; `autre` = nom précisé quand code = OTHER. */
export function LogoPlateforme({ code, avecNom = true, taille = 16, autre }: { code: Plateforme; avecNom?: boolean; taille?: number; autre?: string | null }) {
  const p = code === "OTHER" && autre ? { ...PLATEFORMES.OTHER, nom: autre } : PLATEFORMES[code];
  return (
    <span className="plateforme" title={p.nom}>
      {p.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.logo} alt={avecNom ? "" : p.nom} width={taille} height={taille} />
      )}
      {(avecNom || !p.logo) && <span>{p.nom}</span>}
    </span>
  );
}

// Choix proposés (demande 2026-11-18) : Airbnb, Booking, Lyze, Autre (à préciser). DIRECT et EXPEDIA restent pour les anciennes données.
export const CHOIX_PLATEFORMES: Plateforme[] = ["AIRBNB", "BOOKING", "LYZE", "OTHER"];
