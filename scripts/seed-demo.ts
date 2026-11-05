// Client de démonstration (données fictives) pour voir le tableau de bord rempli.
// Usage : npm run seed:demo   — à ne PAS lancer sur la base de production.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generatePassword, hashPassword } from "../src/lib/passwords";

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const username = "demo.proprietaire";
  const password = generatePassword();

  await db.user.deleteMany({ where: { username } });
  const owner = await db.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      firstName: "Démo",
      lastName: "Propriétaire",
      role: "OWNER",
      onboardedAt: new Date(), // compte de démo : pas de fiche de bienvenue
    },
  });

  const now = new Date();
  const first = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const day = (offset: number) => new Date(first + offset * DAY); // offset 0 = 1er du mois

  const properties = [
    { name: "Appartement Vue Mer", city: "El Jadida" },
    { name: "Studio Centre-Ville", city: "Casablanca" },
    { name: "Villa Palmeraie", city: "Marrakech" },
  ];
  const [mer, studio, villa] = await Promise.all(
    properties.map((p) => db.property.create({ data: { ...p, ownerId: owner.id } })),
  );

  await db.booking.createMany({
    data: [
      // Mois précédent (pour la comparaison)
      { propertyId: mer.id, startDate: day(-20), endDate: day(-15), guestName: "Karim", platform: "AIRBNB", amount: 4200 },
      { propertyId: studio.id, startDate: day(-10), endDate: day(-6), guestName: "Léa", platform: "BOOKING", amount: 2400 },
      // Mois en cours
      { propertyId: mer.id, startDate: day(1), endDate: day(4), guestName: "Sofia", platform: "AIRBNB", amount: 2700 },
      { propertyId: mer.id, startDate: day(13), endDate: day(18), guestName: "Marc", platform: "BOOKING", amount: 4600 },
      { propertyId: mer.id, startDate: day(24), endDate: day(28), guestName: "Yasmine", platform: "EXPEDIA", amount: 3900 },
      { propertyId: studio.id, startDate: day(5), endDate: day(9), guestName: "Hugo", platform: "AIRBNB", amount: 2300 },
      { propertyId: studio.id, startDate: day(19), endDate: day(22), guestName: "Nora", platform: "EXPEDIA", amount: 1800 },
      { propertyId: villa.id, kind: "BLOCKED", startDate: day(8), endDate: day(10), note: "entretien" },
      { propertyId: villa.id, startDate: day(26), endDate: day(33), guestName: "Thomas", platform: "BOOKING", amount: 9800 },
    ],
  });
  await db.$disconnect();

  console.log("\nClient de démo créé :");
  console.log(`  Identifiant  : ${username}`);
  console.log(`  Mot de passe : ${password}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
