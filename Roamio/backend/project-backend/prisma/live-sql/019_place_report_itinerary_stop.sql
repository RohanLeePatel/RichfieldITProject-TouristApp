-- Run in the Supabase SQL editor before deploying the updated backend.
ALTER TABLE public."PlaceReport" ADD COLUMN IF NOT EXISTS "itineraryStop" TEXT;
