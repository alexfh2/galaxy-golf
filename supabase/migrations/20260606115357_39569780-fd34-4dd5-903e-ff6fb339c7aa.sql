ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS result_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS raw_stableford_points integer NULL;

ALTER TABLE public.results
  DROP CONSTRAINT IF EXISTS results_result_status_check;
ALTER TABLE public.results
  ADD CONSTRAINT results_result_status_check
  CHECK (result_status IN ('completed','retired','no_show','disqualified'));

CREATE INDEX IF NOT EXISTS idx_results_result_status ON public.results(result_status);