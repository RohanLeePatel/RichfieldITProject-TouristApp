-- Run in the Supabase SQL editor before deploying the backend that uses this column.
BEGIN;

ALTER TABLE public."TravelGroup"
  ADD COLUMN IF NOT EXISTS "deletedWithTrips" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.sync_travel_group_trip_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."travelGroupId" = NEW."travelGroupId"
       AND (OLD."deletedAt" IS NULL) = (NEW."deletedAt" IS NULL) THEN
      RETURN NEW;
    END IF;
    IF OLD."deletedAt" IS NOT NULL AND NEW."deletedAt" IS NOT NULL THEN
      RETURN NEW;
    END IF;
  ELSIF NEW."deletedAt" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Lock the shared group before checking its trips. Concurrent deletes and
  -- restores of different trips in this group then see each other's changes.
  PERFORM 1 FROM public."TravelGroup"
  WHERE id = NEW."travelGroupId" AND "inviteCode" IS NOT NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW."deletedAt" IS NULL THEN
    UPDATE public."TravelGroup"
    SET "deletedAt" = NULL, "deletedWithTrips" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = NEW."travelGroupId" AND "deletedWithTrips";
  ELSE
    UPDATE public."TravelGroup"
    SET "deletedAt" = NEW."deletedAt", "deletedWithTrips" = TRUE, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = NEW."travelGroupId" AND "deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public."Trip"
        WHERE "travelGroupId" = NEW."travelGroupId" AND "deletedAt" IS NULL
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trip_group_soft_delete ON public."Trip";
CREATE TRIGGER trip_group_soft_delete
AFTER INSERT OR UPDATE OF "deletedAt", "travelGroupId" ON public."Trip"
FOR EACH ROW EXECUTE FUNCTION public.sync_travel_group_trip_lifecycle();

COMMIT;
