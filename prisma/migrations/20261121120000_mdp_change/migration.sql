-- Date du dernier changement de mot de passe par le propriétaire (signalé à la gérante)
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
