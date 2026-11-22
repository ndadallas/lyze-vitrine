import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Copie CHIFFRÉE du mot de passe des propriétaires, lisible par la gérante seule (demande cliente 2026-11-22).
// La connexion vérifie toujours le hash bcrypt ; ceci ne sert qu'à l'affichage côté /admin.
// Clé = env LYZE_CLE_MDP (Vercel). Sans clé : rien n'est stocké ni affiché.
function cle() {
  const secret = process.env.LYZE_CLE_MDP;
  return secret ? createHash("sha256").update(secret).digest() : null;
}

/** "iv.tag.texte" en base64url (AES-256-GCM), ou null si la clé manque. */
export function chiffrerMdp(mdp: string): string | null {
  const k = cle();
  if (!k) return null;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const texte = Buffer.concat([c.update(mdp, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), texte].map((b) => b.toString("base64url")).join(".");
}

/** Mot de passe en clair, ou null (pas de copie, clé absente ou changée). */
export function dechiffrerMdp(enc: string | null | undefined): string | null {
  const k = cle();
  if (!k || !enc) return null;
  try {
    const [iv, tag, texte] = enc.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = createDecipheriv("aes-256-gcm", k, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(texte), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
