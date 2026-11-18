"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { monthStart, parseDay } from "@/lib/dates";
import { Planning } from "@/app/(proprio)/espace/Planning";
import type { BienEspace } from "@/app/(proprio)/espace/EspaceProprietaire";

/** Planning du client côté admin (demande 2026-11-18) : même vue que le client ; un clic ouvre les réservations du bien. */
export function PlanningAdmin({ biens, aujourdhui, base }: { biens: BienEspace[]; aujourdhui: string; base: string }) {
  const router = useRouter();
  const t0 = parseDay(aujourdhui)!;
  const [mois, setMois] = useState(() => monthStart(t0.getUTCFullYear(), t0.getUTCMonth()));
  const ouvrir = (b: BienEspace) => router.push(`${base}?onglet=biens&bien=${b.id}#resas-title`);
  return (
    <Planning
      titre="Tous ses biens"
      aide="Le mois en un coup d’œil, comme le client le voit. Cliquez sur une case ou une barre pour ouvrir les réservations du bien."
      biens={biens}
      mois={mois}
      aujourdhui={aujourdhui}
      onMois={(d) => setMois(new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + d, 1)))}
      onResa={(b) => ouvrir(b)}
      onJourLibre={(b) => ouvrir(b)}
    />
  );
}
