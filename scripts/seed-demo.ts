// Compte propriétaire de démonstration (données fictives) : biens, réservations sur 6 mois, photos,
// fiches, documents classés et demandes, pour montrer l'espace propriétaire rempli.
// Usage : npm run seed:demo — ne touche QU'AU compte demo.proprietaire (supprimé puis recréé),
// donc utilisable aussi sur la base de production pour une démonstration.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generatePassword, hashPassword } from "../src/lib/passwords";

const DAY = 24 * 60 * 60 * 1000;

/** PDF minimal d'une page (texte Helvetica), pour les documents de démo. */
function pdf(titre: string, lignes: string[]) {
  const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[()\\]/g, "");
  const texte = [
    "BT /F1 20 Tf 60 770 Td (" + ascii(titre) + ") Tj ET",
    "BT /F1 10 Tf 60 750 Td (Lyze Conciergerie - document de demonstration) Tj ET",
    ...lignes.map((l, i) => `BT /F1 12 Tf 60 ${710 - i * 20} Td (${ascii(l)}) Tj ET`),
  ].join("\n");
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(texte)} >>\nstream\n${texte}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let corps = "%PDF-1.4\n";
  const positions: number[] = [];
  objets.forEach((o, i) => {
    positions.push(Buffer.byteLength(corps));
    corps += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(corps);
  corps += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  corps += positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("");
  corps += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corps, "latin1");
}

async function photo(id: string) {
  const rep = await fetch(`https://images.unsplash.com/${id}?w=1600&q=75&auto=format&fit=crop&fm=jpg`);
  if (!rep.ok) return null;
  return Buffer.from(await rep.arrayBuffer());
}

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
      email: "demo@example.com",
      phone: "+212 600000000",
      address: "12 rue des Oliviers, El Jadida",
      country: "Maroc",
      contactPreference: "WhatsApp",
      onboardedAt: new Date(), // compte de démo : pas de fiche de bienvenue
    },
  });

  const now = new Date();
  const first = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const day = (offset: number) => new Date(first + offset * DAY); // offset 0 = 1er du mois en cours

  const mer = await db.property.create({
    data: {
      ownerId: owner.id, name: "Appartement Vue Mer", city: "El Jadida", kind: "Appartement",
      address: "Corniche, résidence Al Bahr, El Jadida", bedrooms: 2, capacity: 5, surface: 85,
      equipment: ["Wifi", "Climatisation", "Cuisine équipée", "Lave-linge", "Télévision", "Terrasse ou balcon", "Vue mer", "Ascenseur"],
      wifiName: "AlBahr-4B", wifiPassword: "demo-wifi-2026",
      arrival: "Boîte à clés à droite de l'entrée, code envoyé la veille. Place de parking n°14.",
      notes: "Gardien présent de 8 h à 20 h.",
    },
  });
  const studio = await db.property.create({
    data: {
      ownerId: owner.id, name: "Studio Centre-Ville", city: "Casablanca", kind: "Studio",
      address: "Boulevard d'Anfa, Casablanca", bedrooms: 1, capacity: 2, surface: 38,
      equipment: ["Wifi", "Climatisation", "Cuisine équipée", "Télévision", "Ascenseur"],
      wifiName: "Anfa-Studio", wifiPassword: "demo-studio",
      arrival: "Clés remises par Barka à l'arrivée.",
    },
  });
  const villa = await db.property.create({
    data: {
      ownerId: owner.id, name: "Villa Palmeraie", city: "Marrakech", kind: "Villa",
      address: "Circuit de la Palmeraie, Marrakech", bedrooms: 4, capacity: 8, surface: 260,
      equipment: ["Wifi", "Climatisation", "Chauffage", "Cuisine équipée", "Lave-linge", "Télévision", "Piscine", "Parking", "Barbecue"],
      wifiName: "Palmeraie-Villa", wifiPassword: "demo-villa",
      arrival: "Accueil par le jardinier au portail principal. Piscine chauffée d'avril à octobre.",
      notes: "Entretien de la piscine chaque mardi.",
    },
  });

  // Réservations : 6 mois passés + le mois prochain, montants nets propriétaire.
  const prenoms = ["Karim", "Léa", "Sofia", "Marc", "Yasmine", "Hugo", "Nora", "Thomas", "Inès", "Omar", "Julie", "Mehdi"];
  const plateformes = ["AIRBNB", "BOOKING", "AIRBNB", "EXPEDIA"] as const;
  const rythmes: [string, number[], number][] = [
    [mer.id, [2, 11, 21], 850],
    [studio.id, [4, 15, 24], 520],
    [villa.id, [8, 22], 2600],
  ];
  const sejours = [];
  let n = 0;
  for (let m = -6; m <= 1; m++) {
    const debutMois = Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + m, 1) - first) / DAY);
    for (const [propertyId, jours, tarif] of rythmes) {
      for (const j of jours) {
        n++;
        const nuits = 2 + (n % 5);
        sejours.push({
          propertyId,
          startDate: day(debutMois + j),
          endDate: day(debutMois + j + nuits),
          guestName: prenoms[n % prenoms.length],
          platform: plateformes[n % 4],
          amount: nuits * tarif,
        });
      }
    }
  }
  await db.booking.createMany({ data: sejours });
  await db.booking.createMany({
    data: [
      { propertyId: villa.id, kind: "BLOCKED", startDate: day(-12), endDate: day(-10), note: "entretien" },
      { propertyId: mer.id, kind: "MANAGED", startDate: day(8), endDate: day(10), note: "grand ménage" },
      { propertyId: mer.id, kind: "BLOCKED", startDate: day(40), endDate: day(45), note: "Usage personnel du propriétaire" },
    ],
  });

  // Photos (libres de droits Unsplash, déjà utilisées sur la vitrine)
  const photos: [string, string[]][] = [
    [mer.id, ["photo-1505577058444-a3dab90d4253", "photo-1527760370098-806667fa3750"]],
    [studio.id, ["photo-1565020244281-fe53df7df170", "photo-1612600870196-5757968822bd"]],
    [villa.id, ["photo-1628642004970-1da51c8c7dec", "photo-1708804654353-7ef66cba7776"]],
  ];
  for (const [propertyId, ids] of photos) {
    for (const [position, id] of ids.entries()) {
      const data = await photo(id);
      if (data) await db.photo.create({ data: { propertyId, data: new Uint8Array(data), mimeType: "image/jpeg", position } });
    }
  }

  // Documents classés par catégorie
  const moisLong = (k: number) =>
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1)),
    );
  type Cat = "CONTRAT" | "RELEVE" | "FACTURE" | "ETAT_DES_LIEUX" | "ASSURANCE";
  const docs: { title: string; category: Cat; propertyId?: string; byAdmin?: boolean; lignes: string[]; age: number }[] = [
    {
      title: "Contrat de gestion locative", category: "CONTRAT", age: 170,
      lignes: ["Gestion complete des 3 biens", "Commission Lyze : 20 % du montant des nuitees", "Duree : 12 mois renouvelables"],
    },
    ...[1, 2, 3].map((k) => ({
      title: `Relevé de revenus — ${moisLong(k)}`, category: "RELEVE" as const, age: 30 * k - 25,
      lignes: [`Releve du mois de ${moisLong(k)}`, "Detail des sejours et montants nets reverses", "Virement effectue le 5 du mois suivant"],
    })),
    { title: "Facture ménage et linge", category: "FACTURE", propertyId: villa.id, age: 20, lignes: ["Menage complet apres sejour", "Location et blanchisserie du linge"] },
    { title: "État des lieux d'entrée", category: "ETAT_DES_LIEUX", propertyId: mer.id, age: 165, lignes: ["Inventaire piece par piece", "Releve des compteurs"] },
    {
      title: "Attestation d'assurance habitation", category: "ASSURANCE", propertyId: villa.id, byAdmin: false, age: 160,
      lignes: ["Attestation fournie par le proprietaire"],
    },
  ];
  for (const d of docs) {
    const data = pdf(d.title, d.lignes);
    await db.document.create({
      data: {
        ownerId: owner.id,
        propertyId: d.propertyId ?? null,
        category: d.category,
        title: d.title,
        fileName: `${d.title.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}.pdf`,
        mimeType: "application/pdf",
        size: data.length,
        data: new Uint8Array(data),
        byAdmin: d.byAdmin ?? true,
        createdAt: new Date(Date.now() - d.age * DAY),
      },
    });
  }

  // Demandes : une traitée (les dates bloquées ci-dessus), une en cours, une nouvelle
  await db.ownerRequest.createMany({
    data: [
      {
        ownerId: owner.id, propertyId: mer.id, type: "USAGE_PERSO", status: "TRAITEE", startDate: day(40), endDate: day(45),
        message: "Je viens en famille, merci de prévoir le linge.",
        reply: "C'est noté, les dates sont bloquées et le linge sera prêt.",
        createdAt: new Date(Date.now() - 6 * DAY),
      },
      {
        ownerId: owner.id, propertyId: villa.id, type: "MAINTENANCE", status: "EN_COURS",
        message: "Le voyageur signale que la pompe de la piscine fait du bruit.",
        reply: "Le pisciniste passe jeudi matin.",
        createdAt: new Date(Date.now() - 2 * DAY),
      },
      {
        ownerId: owner.id, propertyId: studio.id, type: "QUESTION", status: "NOUVELLE",
        message: "Est-il possible d'augmenter le prix des nuits pendant l'été ?",
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    ],
  });
  await db.$disconnect();

  console.log("\nCompte de démo créé :");
  console.log(`  Identifiant  : ${username}`);
  console.log(`  Mot de passe : ${password}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
