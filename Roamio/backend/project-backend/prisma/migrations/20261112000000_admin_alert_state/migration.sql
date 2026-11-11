-- Remembers what the admin alert job last emailed about. Additive only.
CREATE TABLE IF NOT EXISTS "AdminAlertState" (
  "id" INTEGER NOT NULL,
  "signature" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminAlertState_pkey" PRIMARY KEY ("id")
);
