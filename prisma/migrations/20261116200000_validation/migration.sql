-- Réservations / blocages saisis par le propriétaire : en attente de validation par la gérante
ALTER TABLE "Booking" ADD COLUMN "pending" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Booking_pending_idx" ON "Booking"("pending");
