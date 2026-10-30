"use client";

import { useState } from "react";
import type { Credentials } from "@/app/(gestion)/admin/actions";
import { IconChat, IconCheck, IconCopy, IconMail } from "@/components/icons";

/** "06 12 34 56 78" / "+212 6…" / "00212 6…" -> "2126…" (format attendu par wa.me). */
function whatsappNumber(phone: string | null) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.length === 10 && digits.startsWith("0")) digits = `212${digits.slice(1)}`; // numéro marocain local
  return digits;
}

/** Affiché une seule fois après génération : le mot de passe n'est stocké que haché. */
export function CredentialsCard({ credentials }: { credentials: Credentials }) {
  const [copied, setCopied] = useState(false);

  // Rendu uniquement côté navigateur (après une action), window est disponible.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const firstName = credentials.name.split(" ")[0];
  const message = [
    `Bonjour ${firstName},`,
    "",
    "Voici vos accès à votre espace propriétaire Lyze :",
    `Adresse : ${origin}/connexion`,
    `Identifiant : ${credentials.username}`,
    `Mot de passe : ${credentials.password}`,
    "",
    "Vous y retrouverez vos biens, vos réservations et vos revenus.",
  ].join("\n");

  const whatsapp = `https://wa.me/${whatsappNumber(credentials.phone)}?text=${encodeURIComponent(message)}`;
  const mail =
    `mailto:${credentials.email ?? ""}` +
    `?subject=${encodeURIComponent("Vos accès à l'espace propriétaire Lyze")}` +
    `&body=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card credentials" role="status">
      <div>
        <h3 style={{ fontSize: 20 }}>Les accès de {credentials.name} sont prêts</h3>
        <p className="muted" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>
          Envoyez-les maintenant : le mot de passe ne sera plus affiché ensuite.
        </p>
      </div>

      <div className="form-grid">
        <div className="field">
          <span className="kpi-label">Identifiant</span>
          <span className="code code-lg">{credentials.username}</span>
        </div>
        <div className="field">
          <span className="kpi-label">Mot de passe</span>
          <span className="code code-lg">{credentials.password}</span>
        </div>
      </div>

      <div className="row">
        <a className="btn btn-primary" href={whatsapp} target="_blank" rel="noreferrer">
          <IconChat size={16} />
          Envoyer par WhatsApp
        </a>
        <a className="btn btn-outline" href={mail}>
          <IconMail size={16} />
          Envoyer par email
        </a>
        <button type="button" className="btn btn-outline" onClick={copy}>
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}
