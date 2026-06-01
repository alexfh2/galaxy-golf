import { supabase } from '@/integrations/supabase/client';

export const publicCircuitDataQueryKey = ['public-circuit-data'] as const;

export type PublicPlayer = {
  id: string;
  name: string;
  license: string | null;
  club: string | null;
  current_handicap: number | null;
  initial_handicap: number | null;
  gender: string | null;
  is_senior: boolean;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicResult = {
  id: string;
  round_id: string;
  player_id: string;
  handicap_at_round: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  category: string | null;
  is_female_prize: boolean;
  is_senior_prize: boolean;
  scorecard: unknown;
  play_date: string | null;
  source_url: string | null;
  extra_play_count?: number | null;
  /** Audit-only: position reported by the source (GolfDirecto/Excel). Not used as primary ranking. */
  official_position?: number | null;
  /** Audit-only: original category label from the source (e.g. "Cat 1", GD category name). */
  official_category?: string | null;
  created_at: string;
  updated_at: string;
  players_public: PublicPlayer | null;
  rounds: {
    status: string;
    name: string;
    round_number: number;
    date: string | null;
    club: string | null;
    course: string | null;
    course_par: unknown;
    course_handicap: unknown;
    course_handicap_women: unknown;
  } | null;
};

export type PublicRoundCompetition = {
  round_id: string;
  competition_id: string;
  stage: string;
  counts_for_ranking: boolean;
  competition_round_number: number | null;
  competition: {
    id: string;
    slug: string;
    name: string;
    competition_type: string;
  } | null;
};

export type PublicCircuitData = {
  players: PublicPlayer[];
  results: PublicResult[];
  round_competitions: PublicRoundCompetition[];
};

export async function fetchPublicCircuitData(): Promise<PublicCircuitData> {
  const { data, error } = await supabase.functions.invoke('public-rankings-data', {
    body: {},
  });

  if (error) throw error;

  const payload = data as PublicCircuitData | null;
  return {
    players: (payload?.players || []) as PublicPlayer[],
    results: (payload?.results || []) as PublicResult[],
    round_competitions: (payload?.round_competitions || []) as PublicRoundCompetition[],
  };
}