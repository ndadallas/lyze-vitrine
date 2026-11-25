-- Suppression côté propriétaire (masqué chez lui, gardé chez Lyze) + documents reçus « vus » par la gérante
ALTER TABLE "OwnerRequest" ADD COLUMN "hiddenByOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OwnerNotice" ADD COLUMN "hiddenByOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "seenAt" TIMESTAMP(3);
-- documents déjà là : considérés comme vus (pas de pastille au déploiement)
UPDATE "Document" SET "seenAt" = "createdAt";
