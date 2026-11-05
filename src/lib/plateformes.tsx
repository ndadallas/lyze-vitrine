// Plateformes d'origine des réservations : libellé + logo (fichiers dans public/assets/img/plateformes).
export const PLATEFORMES = {
  AIRBNB: { nom: "Airbnb", logo: "/assets/img/plateformes/airbnb.svg" },
  BOOKING: { nom: "Booking", logo: "/assets/img/plateformes/booking.svg" },
  EXPEDIA: { nom: "Expedia", logo: "/assets/img/plateformes/expedia.svg" },
  DIRECT: { nom: "Direct", logo: "/assets/img/plateformes/direct.svg" },
  OTHER: { nom: "Autre", logo: null },
} as const;

export type Plateforme = keyof typeof PLATEFORMES;
export const CODES_PLATEFORMES = Object.keys(PLATEFORMES) as [Plateforme, ...Plateforme[]];

/** Petit logo + nom de la plateforme. */
export function LogoPlateforme({ code, avecNom = true, taille = 16 }: { code: Plateforme; avecNom?: boolean; taille?: number }) {
  const p = PLATEFORMES[code];
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

// Lyze ne prend pas de réservation directe : DIRECT reste en base (anciennes données) mais n'est plus proposé.
export const CHOIX_PLATEFORMES: Plateforme[] = CODES_PLATEFORMES.filter((c) => c !== "DIRECT");
