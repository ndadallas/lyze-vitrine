import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { BienvenueForm } from "./BienvenueForm";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function BienvenuePage() {
  const user = await requireOwner();
  if (user.onboardedAt) redirect("/espace");

  return (
    <main className="connexion">
      <a className="fermer-connexion" href="/" aria-label="Retour au site"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M5 5l14 14M19 5L5 19" /></svg></a>
      <div className="connexion-visuel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1505577058444-a3dab90d4253?w=1600&q=80&auto=format&fit=crop"
          alt=""
          fetchPriority="high"
        />
        <a className="logo" href="/"><img src="/assets/img/logo-lyze-creme.png" alt="Lyze Conciergerie" width={599} height={200} />{/* eslint-disable-line @next/next/no-img-element */}</a>
        <blockquote>Votre bien, entre de bonnes mains.</blockquote>
      </div>
      <BienvenueForm prenom={user.firstName} email={user.email ?? ""} />
    </main>
  );
}
