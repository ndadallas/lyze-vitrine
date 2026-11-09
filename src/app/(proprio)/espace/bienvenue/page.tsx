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
