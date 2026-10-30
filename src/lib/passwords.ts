import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

// Minuscules + chiffres, sans caractères ambigus (0/o, 1/l/i) : le mot de passe est dicté
// au téléphone ou tapé sur mobile, sans se soucier des majuscules.
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALL = LOWER + DIGITS;

function pick(chars: string) {
  return chars[randomInt(chars.length)];
}

/** Ex. "kx7m-pq4t-zr9w" : 12 caractères aléatoires (~59 bits, + limitation des tentatives), groupés par 4. */
export function generatePassword(): string {
  for (;;) {
    const raw = Array.from({ length: 12 }, () => pick(ALL)).join("");
    if (/[a-z]/.test(raw) && /[0-9]/.test(raw)) {
      return raw.match(/.{4}/g)!.join("-");
    }
  }
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** "Nadia El Amrani" -> "nadia.el-amrani" */
export function slugUsername(firstName: string, lastName: string) {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return [clean(firstName), clean(lastName)].filter(Boolean).join(".");
}
