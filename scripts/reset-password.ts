// Nouveau mot de passe pour un compte existant (gérante ou client), débloque les tentatives ratées
// et vérifie le résultat contre la base avant de l'afficher.
// Usage : npm run reset-password -- identifiant [mot-de-passe choisi]
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generatePassword, hashPassword, verifyPassword } from "../src/lib/passwords";

async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username) {
    console.error("Usage : npm run reset-password -- identifiant");
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`Aucun compte « ${username} ».`);
    process.exit(1);
  }

  const password = process.argv[3]?.trim() || generatePassword();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), active: true } }),
    db.loginAttempt.deleteMany({ where: { username } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);

  const relu = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const ok = await verifyPassword(password, relu.passwordHash);
  await db.$disconnect();
  if (!ok) throw new Error("Vérification échouée : le mot de passe enregistré ne correspond pas.");

  console.log(`\nMot de passe réinitialisé et vérifié (${user.role}) :`);
  console.log(`  Identifiant  : ${username}`);
  console.log(`  Mot de passe : ${password}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
