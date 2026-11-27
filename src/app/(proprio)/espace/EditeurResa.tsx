"use client";

import { useT } from "@/components/Langue";
import "@/styles/lz.css";

import { useActionState, useState } from "react";
import { enregistrerResa, supprimerResa } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import { confirmer } from "@/components/Envoye";
import { parseDay } from "@/lib/dates";
import { CHOIX_PLATEFORMES, LogoPlateforme, PLATEFORMES } from "@/lib/plateformes";
import { nights } from "@/lib/stats";
import { COMMISSION_LYZE, repartition, TAUX_PLATEFORME } from "@/lib/tarifs";
import type { Plateforme } from "@/lib/plateformes";
import type { BienEspace, ResaEspace } from "./EspaceProprietaire";

const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const jour = (iso: string) => parseDay(iso)!;
const court = (iso: string, locale = "fr-FR") =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
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
  const { t, locale, montant } = useT();
  const [modif, setModif] = useState(false);
  // succès : on referme le formulaire (dans l'action, pas dans un effet)
  const [etat, action, envoi] = useActionState(async (prev: Awaited<ReturnType<typeof enregistrerResa>>, fd: FormData) => {
    const r = await enregistrerResa(prev, fd);
    if (r?.ok) {
      confirmer(t(fd.get("bookingId") ? "Réservation modifiée." : "Réservation enregistrée."));
      setModif(false);
      onFini();
    }
    return r;
  }, undefined);
  const enEdition = brouillon !== null || modif;
  const base = modif && resa ? resa : null;
  const [type, setType] = useState<ResaEspace["type"]>("RESERVED");
  const [plateforme, setPlateforme] = useState<Plateforme>("AIRBNB");
  // dates + montants contrôlés : prix de la nuit × nuits = CA, puis frais plateforme et commission Lyze calculés (modifiables)
  const [du, setDu] = useState(brouillon?.du ?? "");
  const [au, setAu] = useState(brouillon?.au ?? "");
  const [m, setM] = useState({ prixNuit: "", montant: "", frais: "", commission: "" });
  const nbNuits = (d: string, a: string) => {
    const x = parseDay(d), y = parseDay(a);
    return x && y ? nights({ startDate: x, endDate: y }) : 0;
  };
  const depuisCA = (ca: number, plat: Plateforme, prixNuit: string) => {
    const r = repartition(ca, plat);
    return { prixNuit, montant: String(ca), frais: String(r.frais), commission: String(r.commission) };
  };
  const recalculer = (prixNuit: string, d: string, a: string, plat: Plateforme) => {
    const p = Number(prixNuit);
    setM(p > 0 ? depuisCA(p * nbNuits(d, a), plat, prixNuit) : { ...m, prixNuit });
  };

  if (!enEdition || lectureSeule) {
    if (!resa) {
      return (
        <section className="panneau detail" aria-live="polite">
          <span className="titre-p">{t("Calendrier")}</span>
          <p className="vide-msg">
            {lectureSeule
              ? t("Cliquez sur un jour réservé ou bloqué pour voir le détail.")
              : "Cliquez sur un jour libre pour ajouter une réservation ou bloquer des dates, ou sur un jour occupé pour le modifier."}
          </p>
        </section>
      );
    }
    return (
      <section className="panneau detail" aria-live="polite">
        <span className="titre-p">{resa.type === "BLOCKED" ? t(TYPES.BLOCKED) : t("Réservation sélectionnée")}</span>
        <h2>{resa.type === "BLOCKED" ? resa.note || t(TYPES.BLOCKED) : resa.voyageur || t("Voyageur {i}.", { i: resa.initiale ?? "" })}</h2>
        {resa.attente && <p className="lz-attente">{t("En attente de validation par Lyze")}</p>}
        <dl>
          <div>
            <dt>{t("Dates")}</dt>
            <dd>
              {court(resa.du, locale)} → {court(resa.au, locale)} ({t("{n} nuits", { n: nights({ startDate: jour(resa.du), endDate: jour(resa.au) }) })})
            </dd>
          </div>
          {resa.type !== "BLOCKED" && (
            <>
              <div><dt>{t("Plateforme")}</dt><dd><LogoPlateforme code={resa.plateforme} autre={resa.plateformeAutre} taille={18} /></dd></div>
              {resa.prixNuit > 0 && <div><dt>{t("Prix de la nuit")}</dt><dd>{montant(resa.prixNuit)}</dd></div>}
              <div><dt>{t("Chiffre d’affaires")}</dt><dd>{resa.montant > 0 ? montant(resa.montant) : "—"}</dd></div>
              <div><dt>{t("Frais {p}", { p: PLATEFORMES[resa.plateforme].nom })}</dt><dd>{resa.frais > 0 ? `− ${montant(resa.frais)}` : "—"}</dd></div>
              <div><dt>{t("Commission Lyze")}</dt><dd>{resa.commission > 0 ? `− ${montant(resa.commission)}` : "—"}</dd></div>
              <div><dt>{t("Net propriétaire")}</dt><dd>{resa.montant > 0 ? montant(resa.montant - resa.frais - resa.commission) : "—"}</dd></div>
              {resa.note && <div><dt>{t("Note")}</dt><dd>{resa.note}</dd></div>}
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
                setDu(resa.du);
                setAu(resa.au);
                setM({
                  prixNuit: resa.prixNuit ? String(resa.prixNuit) : "",
                  montant: resa.montant ? String(resa.montant) : "",
                  frais: resa.frais ? String(resa.frais) : "",
                  commission: resa.commission ? String(resa.commission) : "",
                });
                setModif(true);
              }}
            >
              {t("Modifier")}
            </button>
            <form action={supprimerResa} data-ok={t("Réservation supprimée.")}>
              <input type="hidden" name="bookingId" value={resa.id} />
              <ConfirmButton message="Supprimer cette ligne du calendrier ?" className="lz-lien lz-danger">
                {t("Supprimer")}
              </ConfirmButton>
            </form>
          </div>
        )}
      </section>
    );
  }

  const ca = Number(m.montant) || 0;
  const net = ca - (Number(m.frais) || 0) - (Number(m.commission) || 0);
  return (
    <section className="panneau detail" aria-live="polite">
      <span className="titre-p">{base ? "Modifier" : "Ajouter au calendrier"}</span>
      <h2 className="lz-h-petit">{bien.nom}</h2>
      <form action={action} className="lz-form lz-form-resa" key={base?.id ?? "nouveau"}>
        <input type="hidden" name="propertyId" value={bien.id} />
        {base && <input type="hidden" name="bookingId" value={base.id} />}
        <label className="lz-champ">
          <span>{t("Type")}</span>
          <select name="kind" value={type} onChange={(e) => setType(e.target.value as ResaEspace["type"])}>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <div className="lz-deux">
          <label className="lz-champ">
            <span>{t("Arrivée")}</span>
            <input type="date" name="startDate" value={du} required onChange={(e) => { setDu(e.target.value); recalculer(m.prixNuit, e.target.value, au, plateforme); }} />
          </label>
          <label className="lz-champ">
            <span>{t("Départ")}</span>
            <input type="date" name="endDate" value={au} required onChange={(e) => { setAu(e.target.value); recalculer(m.prixNuit, du, e.target.value, plateforme); }} />
          </label>
        </div>
        {type === "RESERVED" ? (
          <>
            <label className="lz-champ">
              <span>{t("Plateforme")}</span>
              <select name="platform" value={plateforme} onChange={(e) => { const p = e.target.value as Plateforme; setPlateforme(p); if (ca > 0) setM(depuisCA(ca, p, m.prixNuit)); }}>
                {CHOIX_PLATEFORMES.map((c) => (
                  <option key={c} value={c}>{PLATEFORMES[c].nom}</option>
                ))}
              </select>
            </label>
            {plateforme === "OTHER" && (
              <label className="lz-champ">
                <span>{t("Laquelle ?")}</span>
                <input name="platformOther" required maxLength={60} defaultValue={base?.plateformeAutre ?? ""} placeholder={t("Ex. Abritel, Vrbo, bouche-à-oreille")} />
              </label>
            )}
            <label className="lz-champ">
              <span>{base ? "Nom du voyageur (vide = inchangé)" : "Nom du voyageur"}</span>
              <input name="guestName" maxLength={200} autoComplete="off" />
            </label>
            <div className="lz-deux">
              <label className="lz-champ">
                <span>{t("Prix de la nuit (DH)")}</span>
                <input name="nightPrice" type="number" min={0} step={1} inputMode="numeric" value={m.prixNuit} onChange={(e) => recalculer(e.target.value, du, au, plateforme)} />
              </label>
              <label className="lz-champ">
                <span>Prix de vente total ({nbNuits(du, au)} nuits)</span>
                <input name="amount" type="number" min={0} step={1} inputMode="numeric" value={m.montant} onChange={(e) => setM(depuisCA(Number(e.target.value) || 0, plateforme, m.prixNuit))} />
              </label>
            </div>
            <div className="lz-deux">
              <label className="lz-champ">
                <span>Frais {PLATEFORMES[plateforme].nom} ({TAUX_PLATEFORME[plateforme]} %)</span>
                <input name="fees" type="number" min={0} step={1} inputMode="numeric" value={m.frais} onChange={(e) => setM({ ...m, frais: e.target.value })} />
              </label>
              <label className="lz-champ">
                <span>Commission Lyze ({COMMISSION_LYZE} %)</span>
                <input name="commission" type="number" min={0} step={1} inputMode="numeric" value={m.commission} onChange={(e) => setM({ ...m, commission: e.target.value })} />
              </label>
            </div>
            {ca > 0 && (
              <p className="lz-aide">
                {t("Propriétaire :")} <strong>{montant(net)}</strong> {t("· Lyze :")} <strong>{montant(Number(m.commission) || 0)}</strong>
              </p>
            )}
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
            {t("Annuler")}
          </button>
        </div>
      </form>
    </section>
  );
}
