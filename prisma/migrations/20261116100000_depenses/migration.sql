-- Dépenses par bien (déduites du relevé de revenus)
CREATE TYPE "ExpenseCategory" AS ENUM ('MENAGE', 'LINGE', 'ENTRETIEN', 'EQUIPEMENT', 'CHARGES', 'TAXES', 'AUTRE');

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'AUTRE',
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "byOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_propertyId_date_idx" ON "Expense"("propertyId", "date");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Messages des formulaires du site (réservations voyageurs, demandes de rappel)
CREATE TABLE "SiteMessage" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "language" TEXT,
    "mailSent" BOOLEAN NOT NULL DEFAULT false,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteMessage_createdAt_idx" ON "SiteMessage"("createdAt");
