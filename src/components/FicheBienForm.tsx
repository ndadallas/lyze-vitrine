"use client";

import "@/styles/lz.css";

import { useActionState } from "react";
import { enregistrerFiche } from "@/app/actions/espace";
import { ELECTROMENAGER, EQUIPEMENTS, TYPES_BIEN, type FicheBien } from "@/lib/espace";

/** Fiche descriptive d'un bien : même formulaire dans l'espace propriétaire et dans l'admin. */
export function FicheBienForm({ propertyId, fiche }: { propertyId: string; fiche: FicheBien }) {
  const [etat, action, envoi] = useActionState(enregistrerFiche, undefined);
  const num = (v: number | null) => (v === null ? "" : String(v));

  return (
    <form action={action} className="lz-form lz-fiche">
      <input type="hidden" name="propertyId" value={propertyId} />

      <fieldset className="lz-groupe">
        <legend>Le logement</legend>
        <div className="lz-grille">
          <label className="lz-champ lz-large">
            <span>Nom du bien</span>
            <input name="name" defaultValue={fiche.name} required maxLength={120} />
          </label>
          <label className="lz-champ">
            <span>Ville</span>
            <input name="city" defaultValue={fiche.city} required maxLength={80} />
          </label>
          <label className="lz-champ">
            <span>Catégorie</span>
            <select name="kind" defaultValue={fiche.kind}>
              <option value="">— Choisir —</option>
              {TYPES_BIEN.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="lz-champ lz-pleine">
            <span>Adresse</span>
            <input name="address" defaultValue={fiche.address} autoComplete="off" placeholder="Rue, quartier, ville" />
          </label>
          <label className="lz-champ">
            <span>Chambres</span>
            <input name="bedrooms" type="number" min={0} max={50} inputMode="numeric" defaultValue={num(fiche.bedrooms)} />
          </label>
          <label className="lz-champ">
            <span>Voyageurs max.</span>
            <input name="capacity" type="number" min={0} max={100} inputMode="numeric" defaultValue={num(fiche.capacity)} />
          </label>
          <label className="lz-champ">
            <span>Surface (m²)</span>
            <input name="surface" type="number" min={0} max={10000} inputMode="numeric" defaultValue={num(fiche.surface)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="lz-groupe">
        <legend>Sur le site de Lyze</legend>
        <p className="lz-aide">Affichage sur l’accueil : bouton « Afficher ce bien sur le site » en haut de la page du bien.</p>
        <div className="lz-grille">

          <label className="lz-champ lz-pleine">
            <span>Présentation pour les voyageurs</span>
            <textarea name="description" rows={4} maxLength={2000} defaultValue={fiche.description} placeholder="3 à 4 phrases : l’ambiance, la vue, ce qu’on trouve à proximité…" />
          </label>
          <label className="lz-champ">
            <span>Prix à partir de (MAD / nuit, facultatif)</span>
            <input name="price" type="number" min={0} max={1000000} inputMode="numeric" defaultValue={num(fiche.price)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="lz-groupe">
        <legend>Équipements</legend>
        <div className="lz-coches">
          {EQUIPEMENTS.map((e) => (
            <label key={e}>
              <input type="checkbox" name="equipment" value={e} defaultChecked={fiche.equipment.includes(e)} />
              {e}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="lz-groupe">
        <legend>Électroménager</legend>
        <div className="lz-coches">
          {ELECTROMENAGER.map((e) => (
            <label key={e}>
              <input type="checkbox" name="equipment" value={e} defaultChecked={fiche.equipment.includes(e)} />
              {e}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="lz-groupe">
        <legend>Arrivée des voyageurs</legend>
        <div className="lz-grille">
          <label className="lz-champ">
            <span>Nom du wifi</span>
            <input name="wifiName" defaultValue={fiche.wifiName} autoComplete="off" />
          </label>
          <label className="lz-champ">
            <span>Mot de passe wifi</span>
            <input name="wifiPassword" defaultValue={fiche.wifiPassword} autoComplete="off" spellCheck={false} />
          </label>
          <label className="lz-champ lz-pleine">
            <span>Consignes d’arrivée (clés, accès, parking)</span>
            <textarea name="arrival" rows={3} defaultValue={fiche.arrival} />
          </label>
          <label className="lz-champ lz-pleine">
            <span>À savoir pour Lyze (travaux, voisins, consignes particulières)</span>
            <textarea name="notes" rows={3} defaultValue={fiche.notes} />
          </label>
        </div>
      </fieldset>

      {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
      {etat?.ok && !etat.error && <p className="lz-msg lz-ok" role="status">Fiche enregistrée.</p>}
      <button type="submit" className="lz-bouton" disabled={envoi}>
        {envoi ? "Enregistrement…" : "Enregistrer la fiche"}
      </button>
    </form>
  );
}
