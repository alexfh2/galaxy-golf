
-- Fix 1: Restrict round_competitions SELECT to published rounds for anon
DROP POLICY IF EXISTS "Round competitions are viewable by everyone" ON public.round_competitions;
DROP POLICY IF EXISTS "Public read round_competitions" ON public.round_competitions;
DROP POLICY IF EXISTS "Anyone can view round_competitions" ON public.round_competitions;

CREATE POLICY "Public can view round_competitions of published rounds"
ON public.round_competitions
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = round_competitions.round_id
      AND r.status = 'published'
  )
);

CREATE POLICY "Authenticated can view all round_competitions"
ON public.round_competitions
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Restrict public reads of storage.objects in 'photos' bucket
-- to objects whose photos row belongs to a published round.
DROP POLICY IF EXISTS "Public photos are accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Photos bucket public read" ON storage.objects;
DROP POLICY IF EXISTS "Public access to photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Photos of published rounds are public" ON storage.objects;

CREATE POLICY "Photos of published rounds are public"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1
    FROM public.photos p
    JOIN public.rounds r ON r.id = p.round_id
    WHERE r.status = 'published'
      AND (
        p.url LIKE '%/' || storage.objects.name
        OR p.url LIKE '%/' || storage.objects.name || '?%'
        OR p.url = storage.objects.name
      )
  )
);
