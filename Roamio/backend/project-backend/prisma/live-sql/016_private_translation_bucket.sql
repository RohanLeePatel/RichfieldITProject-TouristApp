-- Run this by hand in the Supabase SQL editor, AFTER deploying ai-features with signed photo
-- links (services/storage_service.py signed_image_url). Until then the saved photos would
-- stop loading, because the history response still carries the old public links.
--
-- Translated photos can show passports, boarding passes or receipts, so the bucket must not
-- be readable by anyone who has (or guesses) a link. ai-features now hands out links that
-- expire after an hour. Its service-role key is unaffected by this.
--
-- Safe to re-run.

update storage.buckets set public = false where id = 'translation-images';
