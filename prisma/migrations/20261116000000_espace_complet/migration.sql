-- Espace propriétaire complet : fiche du bien, documents, demandes
CREATE TYPE "DocCategory" AS ENUM ('CONTRAT', 'RELEVE', 'FACTURE', 'ETAT_DES_LIEUX', 'ASSURANCE', 'IDENTITE', 'AUTRE');
CREATE TYPE "RequestType" AS ENUM ('USAGE_PERSO', 'MENAGE', 'MAINTENANCE', 'QUESTION');
CREATE TYPE "RequestStatus" AS ENUM ('NOUVELLE', 'EN_COURS', 'TRAITEE', 'REFUSEE');

ALTER TABLE "Property"
  ADD COLUMN "kind" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "bedrooms" INTEGER,
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "surface" INTEGER,
  ADD COLUMN "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "wifiName" TEXT,
  ADD COLUMN "wifiPassword" TEXT,
  ADD COLUMN "arrival" TEXT,
  ADD COLUMN "notes" TEXT;

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT,
    "category" "DocCategory" NOT NULL DEFAULT 'AUTRE',
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "byAdmin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerRequest" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'NOUVELLE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OwnerRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Document_ownerId_createdAt_idx" ON "Document"("ownerId", "createdAt");
CREATE INDEX "OwnerRequest_ownerId_createdAt_idx" ON "OwnerRequest"("ownerId", "createdAt");
CREATE INDEX "OwnerRequest_status_idx" ON "OwnerRequest"("status");

ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OwnerRequest" ADD CONSTRAINT "OwnerRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerRequest" ADD CONSTRAINT "OwnerRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
