# Lyze Conciergerie : espace propriétaire

Next.js 16 · Prisma 7 (Postgres) · sessions maison (cookie httpOnly + table `Session`).

Pas d'inscription publique : la gérante crée les comptes depuis `/admin`. Le site génère
l'identifiant (`prenom.nom`) et un mot de passe (`Xxxx-Xxxx-Xxxx`) qu'elle transmet au client.

## Démarrer

```bash
npm install                            # génère aussi le client Prisma
cp .env.example .env
npx prisma migrate dev                 # crée les tables (DATABASE_URL = une base Postgres de dev)
npm run create-admin -- Prénom Nom     # compte de la gérante (affiche le mot de passe)
npm run dev                            # http://localhost:3000/connexion
```

Optionnel : `npm run seed:demo` crée un client fictif avec 3 biens et des réservations.
À ne jamais lancer en production.

## Pages

| Route | Qui | Contenu |
| --- | --- | --- |
| `/connexion` | tous | Connexion (5 essais ratés = blocage 15 min par identifiant) |
| `/espace` | client | Revenus du mois, occupation, nuits, prochaine arrivée, biens, mini-calendrier |
| `/espace/calendrier` | client | Calendrier mensuel par bien, réservations du mois |
| `/admin` | gérante | Créer un client (accès générés), liste des clients |
| `/admin/clients/[id]` | gérante | Nouveau mot de passe, désactiver, biens, réservations et blocages |

## Règles métier

- Une réservation va de la date d'arrivée à la date de départ (exclue) : arrivée le 2 et départ le 4 = 2 nuits.
- « Montant net » = ce que touche le propriétaire. Une réservation à cheval sur deux mois est répartie au prorata des nuits.
- Occupation = nuits réservées / (jours du mois × nombre de biens). Les blocages ne comptent pas comme occupés.
- Le client ne voit que l'initiale du voyageur.
- Générer un nouveau mot de passe ou désactiver un compte déconnecte le client partout.

## Mise en ligne

Hébergé sur Vercel avec une base Postgres (Neon, via Vercel > Storage), qui fournit `DATABASE_URL`.
`npm run build` applique les migrations avant de construire. Les photos sont stockées en base
(pas de disque sur Vercel) et réduites dans le navigateur avant l'envoi (limite 4 Mo par photo).
Premier compte : avec la `DATABASE_URL` de production dans `.env`, lancer `npm run create-admin -- Prénom Nom`.
