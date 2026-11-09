import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="connexion">
      <a className="fermer-connexion" href="/" aria-label="Retour au site"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M5 5l14 14M19 5L5 19" /></svg></a>
      <div className="connexion-visuel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1527769668487-5804e45fed2a?w=1600&q=80&auto=format&fit=crop"
          alt=""
          fetchPriority="high"
        />
        <a className="logo" href="/"><img src="/assets/img/logo-lyze-creme.png" alt="Lyze Conciergerie" width={599} height={200} />{/* eslint-disable-line @next/next/no-img-element */}</a>
        <blockquote>Vos biens, vos réservations et vos revenus, réunis au même endroit.</blockquote>
      </div>

      <LoginForm />
    </main>
  );
}
