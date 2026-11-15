import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // migrations par la connexion directe Neon (le pooler ne gère pas les verrous de prisma migrate)
    url: process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL"),
  },
});
