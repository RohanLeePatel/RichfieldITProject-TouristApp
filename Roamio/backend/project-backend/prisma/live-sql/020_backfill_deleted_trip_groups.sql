-- Archive shared groups whose last trip was deleted before the lifecycle trigger.
-- Run after 018_trip_group_soft_delete.sql. Safe to run again.
BEGIN;

LOCK TABLE public."Trip" IN SHARE ROW EXCLUSIVE MODE;

WITH groups_with_deleted_trips AS (
  SELECT "travelGroupId", MAX("deletedAt") AS "lastDeletedAt"
  FROM public."Trip"
  GROUP BY "travelGroupId"
  HAVING COUNT(*) FILTER (WHERE "deletedAt" IS NULL) = 0
)
UPDATE public."TravelGroup" AS travel_group
SET "deletedAt" = old_trips."lastDeletedAt",
    "deletedWithTrips" = TRUE,
    "updatedAt" = CURRENT_TIMESTAMP
FROM groups_with_deleted_trips AS old_trips
WHERE travel_group.id = old_trips."travelGroupId"
  AND travel_group."inviteCode" IS NOT NULL
  AND travel_group."deletedAt" IS NULL;

COMMIT;
