DROP POLICY IF EXISTS "Admins can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read player photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload player photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update player photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete player photos" ON storage.objects;

CREATE POLICY "Admins can read player photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos'
  AND name LIKE 'players/%'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can upload player photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND name LIKE 'players/%'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update player photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND name LIKE 'players/%'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'photos'
  AND name LIKE 'players/%'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete player photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND name LIKE 'players/%'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);