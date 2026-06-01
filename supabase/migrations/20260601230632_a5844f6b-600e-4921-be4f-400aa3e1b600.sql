DROP POLICY IF EXISTS "Rounds are publicly readable" ON public.rounds;

CREATE POLICY "Published rounds are publicly readable"
ON public.rounds
FOR SELECT
TO public
USING (status = 'published'::round_status);