ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS extra_play_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS import_source text NULL;