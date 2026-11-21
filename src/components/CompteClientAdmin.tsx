"use client";

import "@/styles/lz.css";

import { useActionState } from "react";
import { deleteOwner, resetOwnerPassword, setOwnerActive, updateOwner } from "@/app/(gestion)/admin/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export type CompteClient = {
  id: string;
  civility: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  email: string;
  adresse: string;
  contactPreference: string;
  derniereConnexion: string; // déjà formatée, « Jamais connecté » sinon
  mdpChange: string; // date formatée du dernier changement de mot de passe par le client, "" sinon
  active: boolean;
};

/** Vue gérante, rubrique « Mon compte » du client : ses infos et ses accès (mêmes actions que l'ancienne fiche client). */
export function CompteClientAdmin({ compte: c }: { compte: CompteClient }) {
  const [infos, actionInfos, envoiInfos] = useActionState(updateOwner, undefined);
  const [mdp, actionMdp, envoiMdp] = useActionState(resetOwnerPassword, undefined);

  return (
    <section className="panneau lz-section" id="compte">
      <span className="eyebrow eyebrow--brique">Compte du client</span>
      <h2>
        {c.firstName} {c.lastName}
      </h2>
      <dl className="lz-fiche-lecture">
        <div><dt>Identifiant</dt><dd>{c.username}</dd></div>
        <div><dt>WhatsApp</dt><dd>{c.phone || "—"}</dd></div>
        <div><dt>E-mail</dt><dd>{c.email || "—"}</dd></div>
        <div><dt>Adresse</dt><dd>{c.adresse || "—"}</dd></div>
        <div><dt>Contact préféré</dt><dd>{c.contactPreference || "—"}</dd></div>
        <div><dt>Dernière connexion</dt><dd>{c.derniereConnexion}</dd></div>
        <div><dt>Statut</dt><dd>{c.active ? "Compte actif" : "Compte désactivé"}</dd></div>
      </dl>

      <form action={actionInfos} className="lz-form" key={infos?.done}>
        <span className="titre-p">Modifier ses informations</span>
        <input type="hidden" name="userId" value={c.id} />
        <div className="lz-grille">
          <label className="lz-champ">
            <span>Civilité</span>
            <select name="civility" defaultValue={c.civility}>
              <option value="">—</option>
              <option value="M">M.</option>
              <option value="MME">Mme</option>
            </select>
          </label>
          <label className="lz-champ">
            <span>Prénom</span>
            <input name="firstName" defaultValue={c.firstName} required autoComplete="off" />
          </label>
          <label className="lz-champ">
            <span>Nom</span>
            <input name="lastName" defaultValue={c.lastName} required autoComplete="off" />
          </label>
          <label className="lz-champ">
            <span>Identifiant de connexion</span>
            <input name="username" defaultValue={c.username} required autoComplete="off" spellCheck={false} />
          </label>
          <label className="lz-champ">
            <span>WhatsApp</span>
            <input name="phone" type="tel" defaultValue={c.phone} autoComplete="off" />
          </label>
          <label className="lz-champ">
            <span>E-mail</span>
            <input name="email" type="email" defaultValue={c.email} autoComplete="off" />
          </label>
        </div>
        {infos?.error && <p className="lz-msg lz-erreur" role="alert">{infos.error}</p>}
        {infos?.message && !infos.error && <p className="lz-msg lz-ok" role="status">{infos.message}</p>}
        <button type="submit" className="lz-bouton" disabled={envoiInfos}>
          {envoiInfos ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <form action={actionMdp} className="lz-form">
        <span className="titre-p">Mot de passe</span>
        <p className="lz-aide">
          {c.mdpChange && (
            <>
              Le client a changé son mot de passe le <strong>{c.mdpChange}</strong>.{" "}
            </>
          )}
          Un mot de passe est enregistré brouillé pour la sécurité : personne ne peut le relire, ni vous ni le site. Si le client l’a
          oublié, créez-lui un nouveau mot de passe ci-dessous et envoyez-le-lui.
        </p>
        <input type="hidden" name="userId" value={c.id} />
        <label className="lz-champ">
          <span>Mot de passe choisi (facultatif, 8 caractères minimum)</span>
          <input name="password" type="text" minLength={8} placeholder="Vide = généré automatiquement" autoComplete="off" spellCheck={false} />
        </label>
        {mdp?.error && <p className="lz-msg lz-erreur" role="alert">{mdp.error}</p>}
        {mdp?.credentials && (
          <p className="lz-msg lz-ok" role="status">
            Nouveaux accès : identifiant <strong>{mdp.credentials.username}</strong>, mot de passe <strong>{mdp.credentials.password}</strong>
          </p>
        )}
        <button type="submit" className="lz-bouton" disabled={envoiMdp}>
          {envoiMdp ? "Création…" : "Créer un nouveau mot de passe"}
        </button>
      </form>

      <div className="lz-zone-suppr lz-actions-resa">
        <form action={setOwnerActive}>
          <input type="hidden" name="userId" value={c.id} />
          <input type="hidden" name="active" value={c.active ? "false" : "true"} />
          {c.active ? (
            <ConfirmButton message="Le client ne pourra plus se connecter. Désactiver le compte ?" className="lz-lien lz-danger">
              Désactiver le compte
            </ConfirmButton>
          ) : (
            <button type="submit" className="lz-lien">Réactiver le compte</button>
          )}
        </form>
        <form action={deleteOwner}>
          <input type="hidden" name="userId" value={c.id} />
          <ConfirmButton
            message={`Supprimer définitivement ${c.firstName} ${c.lastName}, ses biens, photos et réservations ? Cette action est irréversible.`}
            className="lz-lien lz-danger"
          >
            Supprimer le client
          </ConfirmButton>
        </form>
      </div>
    </section>
  );
}
