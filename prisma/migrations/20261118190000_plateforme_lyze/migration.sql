-- Plateforme « Lyze » + précision pour « Autre »
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'LYZE';
ALTER TABLE "Booking" ADD COLUMN "platformOther" TEXT;
