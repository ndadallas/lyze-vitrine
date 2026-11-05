"use client";

import { useState } from "react";
import { deleteBooking, updateBooking } from "@/app/(gestion)/admin/actions";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CHOIX_PLATEFORMES, LogoPlateforme, PLATEFORMES, type Plateforme } from "@/lib/plateformes";

export type BookingRowData = {
  id: string;
  kind: "RESERVED" | "BLOCKED";
  platform: Plateforme;
  startDate: string; // "2026-10-02"
  endDate: string; // jour de départ, exclu
  guestName: string | null;
  amount: number;
  note: string | null;
  // libellés déjà formatés côté serveur
  datesLabel: string;
  nights: number;
  amountLabel: string;
};

/** Ligne du tableau des réservations + formulaire de modification dépliable juste en dessous. */
export function BookingRow({ b }: { b: BookingRowData }) {
  const [edition, setEdition] = useState(false);
  const p = `b-${b.id}`;

  return (
    <>
      <tr>
        <td>
          <span className={b.kind === "RESERVED" ? "pill pill-occupied" : "pill pill-blocked"}>
            {b.kind === "RESERVED" ? "Réservé" : "Bloqué"}
          </span>
          {b.kind === "RESERVED" && <LogoPlateforme code={b.platform} />}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>{b.datesLabel}</td>
        <td>{b.nights}</td>
        <td className="muted">{(b.kind === "RESERVED" ? b.guestName : b.note) ?? "—"}</td>
        <td>{b.amountLabel}</td>
        <td style={{ textAlign: "right" }}>
          <div className="row resa-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              aria-expanded={edition}
              onClick={() => setEdition((v) => !v)}
            >
              {edition ? "Fermer" : "Modifier"}
            </button>
            <form action={deleteBooking}>
              <input type="hidden" name="bookingId" value={b.id} />
              <ConfirmButton message="Supprimer cette ligne ?">Supprimer</ConfirmButton>
            </form>
          </div>
        </td>
      </tr>
      {edition && (
        <tr className="row-edit">
          <td colSpan={6}>
            <ActionForm action={updateBooking} submitLabel="Enregistrer" className="form-grid">
              <input type="hidden" name="bookingId" value={b.id} />
              <div className="field">
                <label htmlFor={`${p}-kind`}>Type</label>
                <select id={`${p}-kind`} name="kind" defaultValue={b.kind}>
                  <option value="RESERVED">Réservation</option>
                  <option value="BLOCKED">Blocage (travaux, usage perso…)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${p}-platform`}>Plateforme</label>
                <select id={`${p}-platform`} name="platform" defaultValue={b.platform}>
                  {(CHOIX_PLATEFORMES.includes(b.platform) ? CHOIX_PLATEFORMES : [...CHOIX_PLATEFORMES, b.platform]).map((c) => (
                    <option key={c} value={c}>{PLATEFORMES[c].nom}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${p}-start`}>Arrivée</label>
                <input id={`${p}-start`} name="startDate" type="date" defaultValue={b.startDate} required />
              </div>
              <div className="field">
                <label htmlFor={`${p}-end`}>Départ</label>
                <input id={`${p}-end`} name="endDate" type="date" defaultValue={b.endDate} required />
              </div>
              <div className="field">
                <label htmlFor={`${p}-guest`}>Voyageur</label>
                <input id={`${p}-guest`} name="guestName" defaultValue={b.guestName ?? ""} />
              </div>
              <div className="field">
                <label htmlFor={`${p}-amount`}>Montant net (MAD)</label>
                <input
                  id={`${p}-amount`}
                  name="amount"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={b.kind === "RESERVED" ? b.amount : ""}
                />
              </div>
              <div className="field">
                <label htmlFor={`${p}-note`}>Motif (blocage)</label>
                <input id={`${p}-note`} name="note" defaultValue={b.note ?? ""} />
              </div>
            </ActionForm>
          </td>
        </tr>
      )}
    </>
  );
}
