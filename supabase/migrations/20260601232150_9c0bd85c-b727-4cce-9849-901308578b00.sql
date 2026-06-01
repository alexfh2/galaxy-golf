ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS official_position integer,
  ADD COLUMN IF NOT EXISTS official_category text;