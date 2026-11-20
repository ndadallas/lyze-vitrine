#!/usr/bin/env bash
# Aperçu local (npm run apercu) : base de test en mémoire + comptes demo.proprietaire et test.gerante.
# Mot de passe fixe pour les deux comptes, tiré une seule fois et gardé dans .env.apercu (non versionné).
set -e
cd "$(dirname "$0")/.."
[ -f .env.apercu ] || echo "MDP_APERCU=$(npx tsx -e "import { generatePassword } from './src/lib/passwords'; console.log(generatePassword())")" > .env.apercu
set -a; . ./.env.apercu; set +a
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"

node node_modules/@electric-sql/pglite-socket/dist/scripts/server.js -p 54329 -m 10 &
BASE=$!
trap 'kill $BASE 2>/dev/null' EXIT
until (echo > /dev/tcp/127.0.0.1/54329) 2>/dev/null; do sleep 1; done

npx prisma migrate deploy > /dev/null
npm run -s seed:demo > /dev/null
npm run -s create-admin -- Test Gerante > /dev/null
echo "Aperçu : http://localhost:3123 — comptes demo.proprietaire et test.gerante, mot de passe dans .env.apercu"
npx next dev -p 3123
