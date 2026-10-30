// Crée le compte de la gérante (ou régénère son mot de passe s'il existe déjà).
// Usage : npm run create-admin -- Prénom Nom
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generatePassword, hashPassword, slugUsername } from "../src/lib/passwords";

async function main() {
  const [firstName, lastName] = process.argv.slice(2);
  if (!firstName || !lastName) {
    console.error("Usage : npm run create-admin -- Prénom Nom");
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const username = slugUsername(firstName, lastName);
  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const existing = await db.user.findUnique({ where: { username } });
  if (existing && existing.role !== "ADMIN") {
    console.error(`L'identifiant ${username} appartient déjà à un client.`);
    process.exit(1);
  }

  await db.user.upsert({
    where: { username },
    update: { passwordHash, active: true },
    create: { username, passwordHash, firstName, lastName, role: "ADMIN" },
  });
  await db.session.deleteMany({ where: { user: { username } } });
  await db.$disconnect();

  console.log(`\n${existing ? "Mot de passe régénéré" : "Compte gérante créé"} :`);
  console.log(`  Identifiant  : ${username}`);
  console.log(`  Mot de passe : ${password}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
