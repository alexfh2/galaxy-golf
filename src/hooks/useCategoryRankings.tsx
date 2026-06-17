import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';
import { buildPlayerCategoryHandicapMap } from '@/lib/playerCategoryHandicap';

export type CategoryKey = 'hcpInf' | 'hcpSup' | 'female';

export type RankedPlayer = {
  id: string;
  name: string;
  gender: string | null;
  handicap: number | null;
  total: number;
  roundsPlayed: number;
};

export type CategoryRankings = Record<CategoryKey, RankedPlayer[]>;

type Result = {
  player_id: string;
  stableford_points: number | null;
  handicap_at_round: number | null;
  round_id: string;
  players_public: { name: string; gender: string | null; current_handicap: number | null } | null;
  rounds: { status: string } | null;
};

export function useCategoryRankings() {
  const { data: results } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
    select: (data) => data.results as unknown as Result[],
  });

  const { data: season } = useQuery({
    queryKey: ['public-season'],
    queryFn: async () => {
      const { data } = await supabase.from('seasons').select('rules_config').eq('active', true).single();
      return data;
    },
  });

  const bestN = (season?.rules_config as any)?.best_n_scores || 8;

  const rankings = useMemo<CategoryRankings>(() => {
    const empty: CategoryRankings = { hcpInf: [], hcpSup: [], female: [] };
    if (!results?.length) return empty;

    const categoryHcpMap = buildPlayerCategoryHandicapMap(results as any);

    const byPlayer = new Map<string, {
      name: string;
      gender: string | null;
      handicap: number | null;
      scores: { points: number; weighted: number }[];
    }>();

    for (const r of results) {
      if (!r.players_public || r.stableford_points == null) continue;
      const pid = r.player_id;
      if (!byPlayer.has(pid)) {
        byPlayer.set(pid, {
          name: r.players_public.name,
          gender: r.players_public.gender,
          handicap: categoryHcpMap.get(pid) ?? r.players_public.current_handicap ?? r.handicap_at_round,
          scores: [],
        });
      }
      const weighted = r.stableford_points;
      byPlayer.get(pid)!.scores.push({ points: r.stableford_points, weighted });
    }

    const build = (filterFn: (p: { gender: string | null; handicap: number | null }) => boolean): RankedPlayer[] => {
      const list: RankedPlayer[] = [];
      for (const [id, p] of byPlayer.entries()) {
        if (!filterFn(p)) continue;
        const sorted = [...p.scores].sort((a, b) => b.weighted - a.weighted).slice(0, bestN);
        const total = sorted.reduce((s, x) => s + x.weighted, 0);
        list.push({
          id,
          name: p.name,
          gender: p.gender,
          handicap: p.handicap,
          total,
          roundsPlayed: p.scores.length,
        });
      }
      list.sort((a, b) => b.total - a.total);
      return list;
    };

    return {
      hcpInf: build(p => p.handicap != null && p.handicap <= 15.4),
      hcpSup: build(p => p.handicap != null && p.handicap >= 15.5),
      female: build(p => p.gender === 'F'),
    };
  }, [results, bestN]);

  return rankings;
}

export function buildPlayerRankPositions(rankings: CategoryRankings) {
  const map = new Map<string, Partial<Record<CategoryKey, number>>>();
  (Object.keys(rankings) as CategoryKey[]).forEach(cat => {
    rankings[cat].forEach((p, i) => {
      if (!map.has(p.id)) map.set(p.id, {});
      map.get(p.id)![cat] = i + 1;
    });
  });
  return map;
}
