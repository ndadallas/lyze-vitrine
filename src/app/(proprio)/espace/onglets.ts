// Une page par rubrique de l'espace (demande 2026-11-18) : /espace = Mes biens, /espace/<id> pour les autres.
// Fichier sans "use client" : lu par la page serveur (validation de l'URL) et par le composant client.
export const ONGLETS = [
  ["biens", "Mes biens"],
  ["planning", "Planning"],
  ["revenus", "Revenus"],
  ["depenses", "Dépenses"],
  ["photos", "Photos"],
  ["fiche", "Fiche du bien"],
  ["documents", "Documents"],
  ["demandes", "Demandes"],
  ["messages", "Messages"],
  ["compte", "Mon compte"],
] as const;

// base = "/espace" (propriétaire) ou "/admin/clients/<id>" (vue gérante du même espace)
export const lienOnglet = (id: string, base = "/espace") => (id === "biens" ? base : `${base}/${id}`);
