DROP VIEW IF EXISTS public.players_public;

ALTER TABLE public.players DROP COLUMN IF EXISTS is_senior;
ALTER TABLE public.players DROP COLUMN IF EXISTS birth_year;
ALTER TABLE public.results DROP COLUMN IF EXISTS is_senior_prize;

CREATE VIEW public.players_public
WITH (security_invoker = true) AS
SELECT
  id,
  license,
  name,
  club,
  current_handicap,
  initial_handicap,
  gender,
  photo_url,
  created_at,
  updated_at
FROM public.players;

GRANT SELECT ON public.players_public TO anon, authenticated;