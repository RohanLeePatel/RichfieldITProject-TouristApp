-- Which trip-wizard steps people reach, for the admin funnel. Additive only.
CREATE TABLE IF NOT EXISTS "WizardStepEvent" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "step" INTEGER NOT NULL,
  "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WizardStepEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WizardStepEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WizardStepEvent_at_idx" ON "WizardStepEvent"("at");
CREATE INDEX IF NOT EXISTS "WizardStepEvent_userId_step_idx" ON "WizardStepEvent"("userId", "step");

-- same as the other tables: the API reaches it through Prisma, never the Supabase client
ALTER TABLE "WizardStepEvent" ENABLE ROW LEVEL SECURITY;
