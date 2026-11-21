-- Réservations voyageurs saisies avant l'ajout des frais (2026-11-20) : frais plateforme, commission Lyze (20 %)
-- et prix de la nuit calculés avec les taux par défaut de src/lib/tarifs.ts. Ne touche que les lignes encore à 0.
UPDATE "Booking"
SET "fees" = ROUND("amount" * CASE "platform"
      WHEN 'AIRBNB' THEN 0.18
      WHEN 'BOOKING' THEN 0.20
      WHEN 'EXPEDIA' THEN 0.15
      WHEN 'OTHER' THEN 0.15
      ELSE 0 END),
    "commission" = ROUND("amount" * 0.20)
WHERE "kind" = 'RESERVED' AND "amount" > 0 AND "fees" = 0 AND "commission" = 0;

UPDATE "Booking"
SET "nightPrice" = ROUND("amount" / GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("endDate" - "startDate")) / 86400)))
WHERE "kind" = 'RESERVED' AND "amount" > 0 AND "nightPrice" = 0;
