"use client";

import "@/styles/lz.css";

import { useActionState, useState } from "react";
import { enregistrerResa, supprimerResa } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatMAD, parseDay } from "@/lib/dates";
import { CHOIX_PLATEFORMES, LogoPlateforme, PLATEFORMES } from "@/lib/plateformes";
import { nights } from "@/lib/stats";
import type { BienEspace, ResaEspace } from "./EspaceProprietaire";

const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const jour = (iso: string) => parseDay(iso)!;
const court = (iso: string) => {
  const d = jour(iso);
  return `${d.getUTCDate()} ${MOIS_COURT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const TYPES = { RESERVED: "Réservation voyageur", BLOCKED: "Bloqué par le propriétaire (usage perso, travaux…)", MANAGED: "Réservé par l’entreprise" } as const;

export type Brouillon = { du: string; au: string };

/**
 * Panneau à droite du calendrier : détail de la ligne choisie, ou formulaire pour l'ajouter / la modifier.
 * brouillon = jour libre cliqué (nouvelle ligne pré-remplie). Le parent change la `key` à chaque sélection.
 */
export function EditeurResa({
  bien,
  resa,
  brouillon,
  onFini,
}: {
  bien: BienEspace;
  resa: ResaEspace | null;
  brouillon: Brouillon | null;
  onFini: () => void;
}) {
  const [modif, setModif] = useState(false);
  // succès : on referme le formulaire (dans l'action, pas dans un effet)
  const [etat, action, envoi] = useActionState(async (prev: Awaited<ReturnType<typeof enregistrerResa>>, fd: FormData) => {
    const r = await enregistrerResa(prev, fd);
    if (r?.ok) {
      setModif(false);
      onFini();
    }
    return r;
  }, undefined);
  const enEdition = brouillon !== null || modif;
  const base = modif && resa ? resa : null;
  const [type, setType] = useState<ResaEspace["type"]>("RESERVED");

  if (!enEdition) {
    if (!resa) {
      return (
        <section className="panneau detail" aria-live="polite">
          <span className="titre-p">Calendrier</span>
          <p className="vide-msg">
            Cliquez sur un jour libre pour ajouter une réservation ou bloquer des dates, ou sur un jour occupé pour le
            modifier.
          </p>
        </section>
      );
    }
    return (
      <section className="panneau detail" aria-live="polite">
        <span className="titre-p">{resa.type === "RESERVED" ? "Réservation sélectionnée" : TYPES[resa.type]}</span>
        <h2>{resa.type === "RESERVED" ? `Voyageur ${resa.initiale}.` : resa.note || TYPES[resa.type]}</h2>
        <dl>
          <div>
            <dt>Dates</dt>
            <dd>
              {court(resa.du)} → {court(resa.au)} ({nights({ startDate: jour(resa.du), endDate: jour(resa.au) })} nuits)
            </dd>
          </div>
          {resa.type === "RESERVED" && (
            <>
              <div><dt>Plateforme</dt><dd><LogoPlateforme code={resa.plateforme} taille={18} /></dd></div>
              <div><dt>Montant net</dt><dd>{resa.montant > 0 ? formatMAD(resa.montant) : "—"}</dd></div>
              {resa.note && <div><dt>Note</dt><dd>{resa.note}</dd></div>}
            </>
          )}
        </dl>
        <div className="lz-actions-resa">
          <button
            type="button"
            className="lz-bouton lz-petit"
            onClick={() => {
              setType(resa.type);
              setModif(true);
            }}
          >
            Modifier
          </button>
          <form action={supprimerResa}>
            <input type="hidden" name="bookingId" value={resa.id} />
            <ConfirmButton message="Supprimer cette ligne du calendrier ?" className="lz-lien lz-danger">
              Supprimer
            </ConfirmButton>
          </form>
        </div>
      </section>
    );
  }

  const du = base?.du ?? brouillon?.du ?? "";
  const au = base?.au ?? brouillon?.au ?? "";
  return (
    <section className="panneau detail" aria-live="polite">
      <span className="titre-p">{base ? "Modifier" : "Ajouter au calendrier"}</span>
      <h2 className="lz-h-petit">{bien.nom}</h2>
      <form action={action} className="lz-form lz-form-resa" key={`${base?.id ?? "nouveau"}-${du}`}>
        <input type="hidden" name="propertyId" value={bien.id} />
        {base && <input type="hidden" name="bookingId" value={base.id} />}
        <label className="lz-champ">
          <span>Type</span>
          <select name="kind" value={type} onChange={(e) => setType(e.target.value as ResaEspace["type"])}>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <div className="lz-deux">
          <label className="lz-champ">
            <span>Arrivée</span>
            <input type="date" name="startDate" defaultValue={du} required />
          </label>
          <label className="lz-champ">
            <span>Départ</span>
            <input type="date" name="endDate" defaultValue={au} required />
          </label>
        </div>
        {type === "RESERVED" ? (
          <>
            <label className="lz-champ">
              <span>Plateforme</span>
              <select name="platform" defaultValue={base?.plateforme && base.plateforme !== "DIRECT" ? base.plateforme : "AIRBNB"}>
                {CHOIX_PLATEFORMES.map((c) => (
                  <option key={c} value={c}>{PLATEFORMES[c].nom}</option>
                ))}
              </select>
            </label>
            <label className="lz-champ">
              <span>{base ? "Nom du voyageur (vide = inchangé)" : "Nom du voyageur"}</span>
              <input name="guestName" maxLength={200} autoComplete="off" />
            </label>
            <label className="lz-champ">
              <span>Montant net pour vous (MAD)</span>
              <input name="amount" type="number" min={0} step={1} inputMode="numeric" defaultValue={base?.montant || ""} />
            </label>
          </>
        ) : (
          <input type="hidden" name="platform" value="AIRBNB" />
        )}
        <label className="lz-champ">
          <span>{type === "RESERVED" ? "Note (facultatif)" : "Motif (facultatif)"}</span>
          <input name="note" maxLength={200} defaultValue={base?.note ?? ""} placeholder={type === "BLOCKED" ? "Ex. séjour en famille" : ""} />
        </label>
        {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
        <div className="lz-actions-resa">
          <button type="submit" className="lz-bouton lz-petit" disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            className="lz-lien"
            onClick={() => {
              setModif(false);
              onFini();
            }}
          >
            Annuler
          </button>
        </div>
      </form>
    </section>
  );
}
