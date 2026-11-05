import * as z from "zod";

// Formulaire de contact de la vitrine → e-mail à Lyze via l'API HTTP de Resend (pas de dépendance).
// Variables : RESEND_API_KEY (obligatoire), CONTACT_TO (défaut contact@lyze.ma), CONTACT_FROM (expéditeur vérifié chez Resend).

const ContactSchema = z.object({
  nom: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  telephone: z.string().trim().max(40).regex(/^[+\d\s.\-()]*$/),
  ville: z.string().trim().max(60).optional(),
  meuble: z.string().trim().max(30).optional(),
  message: z.string().trim().max(5000).optional(),
  site: z.string().max(200).optional(), // piège à robots : doit rester vide
  langue: z.enum(["fr", "en", "ar"]).optional(),
});

// shortcut: limite en mémoire par instance (best effort en serverless) ; passer à un store partagé si spam réel.
const derniers = new Map<string, number[]>();
function tropDeMessages(ip: string) {
  const maintenant = Date.now();
  const recents = (derniers.get(ip) ?? []).filter((t) => maintenant - t < 10 * 60 * 1000);
  recents.push(maintenant);
  derniers.set(ip, recents);
  return recents.length > 5;
}

export async function POST(req: Request) {
  const corps = await req.json().catch(() => null);
  const parsed = ContactSchema.safeParse(corps);
  if (!parsed.success) return Response.json({ error: "Formulaire invalide." }, { status: 400 });
  const d = parsed.data;
  if (d.site) return Response.json({ ok: true }); // robot : on fait comme si de rien n'était

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  if (tropDeMessages(ip)) return Response.json({ error: "Trop de messages, réessayez plus tard." }, { status: 429 });

  const cle = process.env.RESEND_API_KEY;
  if (!cle) return Response.json({ error: "Envoi d'e-mails non configuré." }, { status: 503 });

  const texte = [
    `Nom : ${d.nom}`,
    `E-mail : ${d.email}`,
    `Téléphone : ${d.telephone || "—"}`,
    `Ville du bien : ${d.ville || "—"}`,
    `Meublé : ${d.meuble || "—"}`,
    `Langue du site : ${{ ar: "arabe", en: "anglais", fr: "français" }[d.langue ?? "fr"]}`,
    "",
    d.message || "(pas de message)",
  ].join("\n");

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || "Site Lyze <onboarding@resend.dev>",
      to: [process.env.CONTACT_TO || "contact@lyze.ma"],
      reply_to: d.email,
      subject: `Demande de rappel — ${d.nom}${d.ville ? ` (${d.ville})` : ""}`.slice(0, 150),
      text: texte,
    }),
  }).catch(() => null);

  if (!r?.ok) {
    console.error("Contact : échec de l'envoi Resend", r?.status, await r?.text().catch(() => ""));
    return Response.json({ error: "L'envoi a échoué." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
