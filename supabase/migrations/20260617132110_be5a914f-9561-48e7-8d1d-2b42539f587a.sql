
DROP POLICY IF EXISTS "Photos of published rounds are public" ON storage.objects;

CREATE POLICY "Photos bucket: public read for player and published-round photos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'photos'
  AND (
    -- Player avatars: always public
    name LIKE 'players/%'
    -- Round photos: only when linked to a published round
    OR EXISTS (
      SELECT 1
      FROM public.photos p
      JOIN public.rounds r ON r.id = p.round_id
      WHERE r.status = 'published'
        AND (
          p.url LIKE '%/' || storage.objects.name
          OR p.url LIKE '%/' || storage.objects.name || '?%'
        )
    )
  )
);
