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
// « Réservé par l’entreprise » (MANAGED) retiré le 2026-11-18 : converti en réservation via Lyze
const TYPES = { RESERVED: "Réservation voyageur", BLOCKED: "Bloqué par le propriétaire (usage perso, travaux…)" } as const;

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
  lectureSeule = false,
}: {
  bien: BienEspace;
  resa: ResaEspace | null;
  brouillon: Brouillon | null;
  onFini: () => void;
  /** Espace du propriétaire : consultation seulement (demande 2026-11-18), seule la gérante modifie. */
  lectureSeule?: boolean;
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
  const [plateforme, setPlateforme] = useState<string>("AIRBNB");

  if (!enEdition || lectureSeule) {
    if (!resa) {
      return (
        <section className="panneau detail" aria-live="polite">
          <span className="titre-p">Calendrier</span>
          <p className="vide-msg">
            {lectureSeule
              ? "Cliquez sur un jour réservé ou bloqué pour voir le détail."
              : "Cliquez sur un jour libre pour ajouter une réservation ou bloquer des dates, ou sur un jour occupé pour le modifier."}
          </p>
        </section>
      );
    }
    return (
      <section className="panneau detail" aria-live="polite">
        <span className="titre-p">{resa.type === "BLOCKED" ? TYPES.BLOCKED : "Réservation sélectionnée"}</span>
        <h2>{resa.type === "BLOCKED" ? resa.note || TYPES.BLOCKED : resa.voyageur || `Voyageur ${resa.initiale}.`}</h2>
        {resa.attente && <p className="lz-attente">En attente de validation par Lyze</p>}
        <dl>
          <div>
            <dt>Dates</dt>
            <dd>
              {court(resa.du)} → {court(resa.au)} ({nights({ startDate: jour(resa.du), endDate: jour(resa.au) })} nuits)
            </dd>
          </div>
          {resa.type !== "BLOCKED" && (
            <>
              <div><dt>Plateforme</dt><dd><LogoPlateforme code={resa.plateforme} autre={resa.plateformeAutre} taille={18} /></dd></div>
              <div><dt>Chiffre d’affaires</dt><dd>{resa.montant > 0 ? formatMAD(resa.montant) : "—"}</dd></div>
              <div><dt>Frais</dt><dd>{resa.frais > 0 ? `− ${formatMAD(resa.frais)}` : "—"}</dd></div>
              <div><dt>Net</dt><dd>{resa.montant > 0 ? formatMAD(resa.montant - resa.frais) : "—"}</dd></div>
              {resa.note && <div><dt>Note</dt><dd>{resa.note}</dd></div>}
            </>
          )}
        </dl>
        {!lectureSeule && (
          <div className="lz-actions-resa">
            <button
              type="button"
              className="lz-bouton lz-petit"
              onClick={() => {
                setType(resa.type === "BLOCKED" ? "BLOCKED" : "RESERVED");
                setPlateforme(resa.plateforme);
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
        )}
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
              <select name="platform" value={plateforme} onChange={(e) => setPlateforme(e.target.value)}>
                {CHOIX_PLATEFORMES.map((c) => (
                  <option key={c} value={c}>{PLATEFORMES[c].nom}</option>
                ))}
              </select>
            </label>
            {plateforme === "OTHER" && (
              <label className="lz-champ">
                <span>Laquelle ?</span>
                <input name="platformOther" required maxLength={60} defaultValue={base?.plateformeAutre ?? ""} placeholder="Ex. Abritel, Vrbo, bouche-à-oreille" />
              </label>
            )}
            <label className="lz-champ">
              <span>{base ? "Nom du voyageur (vide = inchangé)" : "Nom du voyageur"}</span>
              <input name="guestName" maxLength={200} autoComplete="off" />
            </label>
            <label className="lz-champ">
              <span>Chiffre d’affaires (MAD)</span>
              <input name="amount" type="number" min={0} step={1} inputMode="numeric" defaultValue={base?.montant || ""} />
            </label>
            <label className="lz-champ">
              <span>Frais : commission + plateforme (MAD)</span>
              <input name="fees" type="number" min={0} step={1} inputMode="numeric" defaultValue={base?.frais || ""} />
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
