-- Push notifications: delivery bookkeeping on PushSubscription, and a deep link
-- plus dedupe key on Notification. Additive only.
ALTER TABLE "PushSubscription"
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "failureCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "url" TEXT,
  ADD COLUMN IF NOT EXISTS "tripId" INTEGER,
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");
