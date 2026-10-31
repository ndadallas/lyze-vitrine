-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('DIRECT', 'AIRBNB', 'BOOKING', 'EXPEDIA', 'OTHER');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'DIRECT';

-- AlterTable : fiche remplie par le propriétaire à sa première connexion
ALTER TABLE "User" ADD COLUMN "address" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "contactPreference" TEXT,
ADD COLUMN "onboardedAt" TIMESTAMP(3);
