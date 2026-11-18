-- Expedia remplacé par Lyze ; « Réservé par l'entreprise » devient une réservation Lyze.
-- Migration séparée de la précédente : une valeur d'enum ajoutée ne peut pas servir dans la même transaction.
UPDATE "Booking" SET "platform" = 'LYZE' WHERE "platform" = 'EXPEDIA';
UPDATE "Booking" SET "kind" = 'RESERVED', "platform" = 'LYZE' WHERE "kind" = 'MANAGED';
