-- Civilité du propriétaire + messages de Lyze aux propriétaires
ALTER TABLE "User" ADD COLUMN "civility" TEXT;

CREATE TABLE "OwnerNotice" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnerNotice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OwnerNotice_ownerId_createdAt_idx" ON "OwnerNotice"("ownerId", "createdAt");
ALTER TABLE "OwnerNotice" ADD CONSTRAINT "OwnerNotice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerNotice" ADD CONSTRAINT "OwnerNotice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
