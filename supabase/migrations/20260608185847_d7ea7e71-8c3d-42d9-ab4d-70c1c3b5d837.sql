
DROP POLICY IF EXISTS "Photos are publicly readable" ON public.photos;
CREATE POLICY "Photos for published rounds are public"
ON public.photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = photos.round_id AND r.status = 'published'
  )
);

DROP POLICY IF EXISTS "Public read individual photos" ON storage.objects;
CREATE POLICY "Public read photos bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');
