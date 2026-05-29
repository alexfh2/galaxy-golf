-- 1. competitions
CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  competition_type text NOT NULL CHECK (competition_type IN ('stableford_accumulated', 'fedex_points')),
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  rules_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, slug)
);

GRANT SELECT ON public.competitions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Competitions are publicly readable"
  ON public.competitions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage competitions"
  ON public.competitions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_competitions_season_id ON public.competitions(season_id);

CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. round_competitions
CREATE TABLE public.round_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'regular' CHECK (stage IN ('regular', 'major', 'playoff', 'final')),
  competition_round_number integer NULL,
  counts_for_ranking boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, competition_id)
);

GRANT SELECT ON public.round_competitions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_competitions TO authenticated;
GRANT ALL ON public.round_competitions TO service_role;

ALTER TABLE public.round_competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Round competitions are publicly readable"
  ON public.round_competitions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage round competitions"
  ON public.round_competitions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_round_competitions_round_id ON public.round_competitions(round_id);
CREATE INDEX idx_round_competitions_competition_id ON public.round_competitions(competition_id);

-- 3. Seed for season 2026 if exists
INSERT INTO public.competitions (season_id, name, slug, competition_type, display_order)
SELECT s.id, 'Circuito GalaxyGolf', 'circuito-galaxygolf', 'stableford_accumulated', 1
FROM public.seasons s
WHERE s.year = 2026
ON CONFLICT (season_id, slug) DO NOTHING;

INSERT INTO public.competitions (season_id, name, slug, competition_type, display_order)
SELECT s.id, 'GalaxyCup', 'galaxycup', 'fedex_points', 2
FROM public.seasons s
WHERE s.year = 2026
ON CONFLICT (season_id, slug) DO NOTHING;