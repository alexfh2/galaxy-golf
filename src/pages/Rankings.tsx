import { useMemo, useState } from 'react';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchPublicCircuitData,
  publicCircuitDataQueryKey,
  type PublicResult,
  type PublicRoundCompetition,
} from '@/lib/publicCircuitData';
import {
  getGalaxyGolfCategoryByHandicap,
  getGalaxyGolfCategoryLabel,
} from '@/lib/playerCategoryHandicap';

/* ============================================================
 * Rankings GalaxyGolf 2026 — MVP
 * Circuito GalaxyGolf (Stableford best 7 + bonus participación)
 * GalaxyCup (tabla por posición Regular/Major)
 * Categorías: Hándicap Inferior ≤15,4 — Hándicap Superior ≥15,5
 * No usa is_master / master_coefficient.
 * Gran Final, Playoffs y Challenge GLX → pendientes de fase futura.
 * ============================================================ */

type Category = 'hcp_low' | 'hcp_high';

const GALAXYCUP_REGULAR_POINTS = [
  500, 300, 190, 135, 110, 100, 90, 85, 80, 75, 70, 65, 60, 57, 56, 55, 54, 53, 52, 51,
];
const GALAXYCUP_MAJOR_POINTS = [
  750, 450, 285, 200, 165, 150, 135, 125, 120, 115, 110, 105, 100, 90, 85, 80, 75, 70, 65, 60,
];

const sortKey = (r: PublicResult) => {
  const d = r.rounds?.date || r.play_date || '9999-99-99';
  const n = String(r.rounds?.round_number ?? 9999).padStart(4, '0');
  const c = r.created_at || '';
  return `${d}|${n}|${c}`;
};

interface CircuitoRow {
  player_id: string;
  name: string;
  category: Category;
  firstHcp: number;
  rounds_played: number;
  best7: number;
  bonus: number;
  total: number;
}

interface GalaxyCupRow {
  player_id: string;
  name: string;
  category: Category;
  firstHcp: number;
  rounds_played: number;
  majors_played: number;
  points: number;
  best_position: number | null;
  best_was_major: boolean;
}

function computeCircuito(
  results: PublicResult[],
  roundComps: PublicRoundCompetition[],
): CircuitoRow[] {
  // round_ids válidos: circuito-galaxygolf · regular · counts_for_ranking
  const validRoundIds = new Set(
    roundComps
      .filter(
        (rc) =>
          rc.competition?.slug === 'circuito-galaxygolf' &&
          rc.stage === 'regular' &&
          rc.counts_for_ranking,
      )
      .map((rc) => rc.round_id),
  );

  const filtered = results.filter(
    (r) => validRoundIds.has(r.round_id) && r.stableford_points != null,
  );

  // Agrupar por jugador
  const byPlayer = new Map<string, PublicResult[]>();
  for (const r of filtered) {
    const arr = byPlayer.get(r.player_id) ?? [];
    arr.push(r);
    byPlayer.set(r.player_id, arr);
  }

  const rows: CircuitoRow[] = [];
  for (const [pid, list] of byPlayer.entries()) {
    const player = list[0]?.players_public;
    if (!player) continue;

    // Primera prueba con HCP no nulo
    const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const firstWithHcp = sorted.find((r) => r.handicap_at_round != null);
    const firstHcp = Number(firstWithHcp?.handicap_at_round ?? NaN);
    const category = getGalaxyGolfCategoryByHandicap(firstHcp);
    if (!category) continue;

    const stablefords = list
      .map((r) => Number(r.stableford_points ?? 0))
      .sort((a, b) => b - a);
    const best7 = stablefords.slice(0, 7).reduce((s, n) => s + n, 0);

    const bonus = list.reduce(
      (s, r) => s + 1 + Number(r.extra_play_count ?? 0),
      0,
    );

    rows.push({
      player_id: pid,
      name: player.name,
      category,
      firstHcp,
      rounds_played: list.length,
      best7,
      bonus,
      total: best7 + bonus,
    });
  }

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.firstHcp !== b.firstHcp) return a.firstHcp - b.firstHcp;
    return a.name.localeCompare(b.name, 'es');
  });

  return rows;
}

function computeGalaxyCup(
  results: PublicResult[],
  roundComps: PublicRoundCompetition[],
): GalaxyCupRow[] {
  // round → stage (regular|major) para GalaxyCup
  const roundStage = new Map<string, 'regular' | 'major'>();
  for (const rc of roundComps) {
    if (
      rc.competition?.slug === 'galaxycup' &&
      rc.counts_for_ranking &&
      (rc.stage === 'regular' || rc.stage === 'major')
    ) {
      roundStage.set(rc.round_id, rc.stage);
    }
  }

  const filtered = results.filter(
    (r) => roundStage.has(r.round_id) && r.stableford_points != null,
  );

  // Categoría fija por jugador
  const playerCategory = new Map<string, Category>();
  const playerFirstHcp = new Map<string, number>();

  const byPlayerAll = new Map<string, PublicResult[]>();
  for (const r of filtered) {
    const arr = byPlayerAll.get(r.player_id) ?? [];
    arr.push(r);
    byPlayerAll.set(r.player_id, arr);
  }

  for (const [pid, list] of byPlayerAll.entries()) {
    const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const firstWithHcp = sorted.find((r) => r.handicap_at_round != null);
    const hcp = Number(firstWithHcp?.handicap_at_round ?? NaN);
    const cat = getGalaxyGolfCategoryByHandicap(hcp);
    if (cat) {
      playerCategory.set(pid, cat);
      playerFirstHcp.set(pid, hcp);
    }
  }

  // Asignar puntos por jornada + categoría
  type Award = { points: number; position: number; isMajor: boolean };
  const awardsByPlayer = new Map<string, Award[]>();
  const majorsByPlayer = new Map<string, number>();

  // Agrupar por round
  const byRound = new Map<string, PublicResult[]>();
  for (const r of filtered) {
    if (!playerCategory.has(r.player_id)) continue;
    const arr = byRound.get(r.round_id) ?? [];
    arr.push(r);
    byRound.set(r.round_id, arr);
  }

  for (const [roundId, list] of byRound.entries()) {
    const stage = roundStage.get(roundId)!;
    const table = stage === 'major' ? GALAXYCUP_MAJOR_POINTS : GALAXYCUP_REGULAR_POINTS;
    const isMajor = stage === 'major';

    // Separar por categoría fija
    const byCat: Record<Category, PublicResult[]> = { hcp_low: [], hcp_high: [] };
    for (const r of list) {
      const cat = playerCategory.get(r.player_id)!;
      byCat[cat].push(r);
    }

    for (const cat of ['hcp_low', 'hcp_high'] as Category[]) {
      // Primary sort: Stableford desc within the GalaxyGolf category.
      // Tiebreak (prudent): only use official_position from the source if ALL tied players
      // share the same official_category — otherwise GD/Excel positions came from a different
      // category split and are not comparable. official_* fields are audit data, never used
      // as a direct ranking source.
      const sorted = byCat[cat].sort((a, b) => {
        const sa = Number(a.stableford_points ?? 0);
        const sb = Number(b.stableford_points ?? 0);
        if (sb !== sa) return sb - sa;
        const ocA = a.official_category ?? null;
        const ocB = b.official_category ?? null;
        const opA = a.official_position ?? null;
        const opB = b.official_position ?? null;
        if (ocA && ocB && ocA === ocB && opA != null && opB != null) {
          return opA - opB;
        }
        const hA = Number(a.handicap_at_round ?? 999);
        const hB = Number(b.handicap_at_round ?? 999);
        if (hA !== hB) return hA - hB;
        const nA = a.players_public?.name ?? '';
        const nB = b.players_public?.name ?? '';
        return nA.localeCompare(nB, 'es');
      });
      sorted.forEach((r, idx) => {
        const position = idx + 1;
        const points = position <= 20 ? table[position - 1] : 0;
        const arr = awardsByPlayer.get(r.player_id) ?? [];
        arr.push({ points, position, isMajor });
        awardsByPlayer.set(r.player_id, arr);
        if (isMajor) {
          majorsByPlayer.set(r.player_id, (majorsByPlayer.get(r.player_id) ?? 0) + 1);
        }
      });
    }
  }

  const rows: GalaxyCupRow[] = [];
  for (const [pid, awards] of awardsByPlayer.entries()) {
    const player = byPlayerAll.get(pid)?.[0]?.players_public;
    if (!player) continue;
    const points = awards.reduce((s, a) => s + a.points, 0);
    let best: Award | null = null;
    for (const a of awards) {
      if (!best || a.position < best.position) best = a;
    }
    rows.push({
      player_id: pid,
      name: player.name,
      category: playerCategory.get(pid)!,
      firstHcp: playerFirstHcp.get(pid) ?? 999,
      rounds_played: awards.length,
      majors_played: majorsByPlayer.get(pid) ?? 0,
      points,
      best_position: best?.position ?? null,
      best_was_major: best?.isMajor ?? false,
    });
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const ap = a.best_position ?? 9999;
    const bp = b.best_position ?? 9999;
    if (ap !== bp) return ap - bp;
    if (a.firstHcp !== b.firstHcp) return a.firstHcp - b.firstHcp;
    return a.name.localeCompare(b.name, 'es');
  });

  return rows;
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-[hsl(var(--gg-gold))]/30 bg-[hsl(var(--gg-ivory))]/5 px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function CategoryTabs({
  category,
  onChange,
}: {
  category: Category;
  onChange: (c: Category) => void;
}) {
  return (
    <Tabs value={category} onValueChange={(v) => onChange(v as Category)} className="mb-6">
      <TabsList className="bg-[hsl(var(--gg-navy))]/10">
        <TabsTrigger value="hcp_low">Hándicap Inferior</TabsTrigger>
        <TabsTrigger value="hcp_high">Hándicap Superior</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default function Rankings() {
  const { data, isLoading, error } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
  });

  const [circuitoCat, setCircuitoCat] = useState<Category>('hcp_low');
  const [galaxyCupCat, setGalaxyCupCat] = useState<Category>('hcp_low');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const circuitoRows = useMemo(
    () => (data ? computeCircuito(data.results, data.round_competitions) : []),
    [data],
  );
  const galaxyCupRows = useMemo(
    () => (data ? computeGalaxyCup(data.results, data.round_competitions) : []),
    [data],
  );

  const circuitoFiltered = circuitoRows.filter((r) => r.category === circuitoCat);
  const galaxyCupFiltered = galaxyCupRows.filter((r) => r.category === galaxyCupCat);

  const hasAnyResults = (data?.results.length ?? 0) > 0;

  return (
    <>
      {/* Cabecera editorial */}
      <section className="relative overflow-hidden bg-[hsl(var(--gg-navy))] text-[hsl(var(--gg-ivory))]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full border border-[hsl(var(--gg-gold))]/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full border border-[hsl(var(--gg-green))]/40"
        />
        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <p className="mb-4 text-xs font-medium tracking-[0.3em] text-[hsl(var(--gg-gold))]">
            TEMPORADA 2026
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-light leading-tight">
            Rankings GalaxyGolf
          </h1>
          <p className="mt-6 max-w-2xl text-base md:text-lg text-[hsl(var(--gg-ivory))]/75">
            Consulta la clasificación actualizada del Circuito GalaxyGolf y la GalaxyCup.
          </p>
        </div>
      </section>

      <section className="bg-background py-12">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <EmptyMessage>Cargando rankings...</EmptyMessage>
          ) : error ? (
            <EmptyMessage>No se han podido cargar los rankings.</EmptyMessage>
          ) : !hasAnyResults ? (
            <EmptyMessage>
              Los rankings se actualizarán cuando se publiquen los primeros resultados oficiales.
            </EmptyMessage>
          ) : (
            <Tabs defaultValue="circuito" className="w-full">
              <TabsList className="mb-8 bg-[hsl(var(--gg-navy))]/10">
                <TabsTrigger value="circuito" className="px-6">
                  Circuito GalaxyGolf
                </TabsTrigger>
                <TabsTrigger value="galaxycup" className="px-6">
                  GalaxyCup
                </TabsTrigger>
              </TabsList>

              {/* ============ Circuito GalaxyGolf ============ */}
              <TabsContent value="circuito">
                <CategoryTabs category={circuitoCat} onChange={setCircuitoCat} />

                {circuitoRows.length === 0 ? (
                  <EmptyMessage>
                    Todavía no hay resultados publicados del Circuito GalaxyGolf.
                  </EmptyMessage>
                ) : circuitoFiltered.length === 0 ? (
                  <EmptyMessage>
                    No hay jugadores en la categoría {getGalaxyGolfCategoryLabel(circuitoCat)} todavía.
                  </EmptyMessage>
                ) : (
                  <div className="rounded-lg border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Pos.</TableHead>
                          <TableHead>Jugador</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-center">Pruebas</TableHead>
                          <TableHead className="text-center">Mejores 7</TableHead>
                          <TableHead className="text-center">Bonus</TableHead>
                          <TableHead className="text-center font-semibold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {circuitoFiltered.map((r, i) => (
                          <TableRow key={r.player_id} className="group">
                            <TableCell className="font-medium text-[hsl(var(--gg-gold))]">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerId(r.player_id)}
                                className="font-medium text-left transition-colors group-hover:text-[hsl(var(--gg-green))] hover:text-[hsl(var(--gg-green))]"
                              >
                                {r.name}
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {getGalaxyGolfCategoryLabel(r.category)}
                            </TableCell>
                            <TableCell className="text-center">{r.rounds_played}</TableCell>
                            <TableCell className="text-center">{r.best7}</TableCell>
                            <TableCell className="text-center">+{r.bonus}</TableCell>
                            <TableCell className="text-center font-semibold text-[hsl(var(--gg-green))]">
                              {r.total}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <p className="mt-6 text-xs text-muted-foreground italic">
                  Ranking regular provisional. La Gran Final se implementará en una fase posterior.
                </p>
              </TabsContent>

              {/* ============ GalaxyCup ============ */}
              <TabsContent value="galaxycup">
                <CategoryTabs category={galaxyCupCat} onChange={setGalaxyCupCat} />

                {galaxyCupRows.length === 0 ? (
                  <EmptyMessage>
                    Todavía no hay resultados publicados de la GalaxyCup.
                  </EmptyMessage>
                ) : galaxyCupFiltered.length === 0 ? (
                  <EmptyMessage>
                    No hay jugadores en la categoría {getGalaxyGolfCategoryLabel(galaxyCupCat)} todavía.
                  </EmptyMessage>
                ) : (
                  <div className="rounded-lg border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Pos.</TableHead>
                          <TableHead>Jugador</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-center">Pruebas</TableHead>
                          <TableHead className="text-center">Majors</TableHead>
                          <TableHead className="text-center font-semibold">Puntos</TableHead>
                          <TableHead className="text-center">Mejor resultado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {galaxyCupFiltered.map((r, i) => (
                          <TableRow key={r.player_id} className="group">
                            <TableCell className="font-medium text-[hsl(var(--gg-gold))]">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <Link
                                to={`/jugadors/${r.player_id}`}
                                className="font-medium transition-colors group-hover:text-[hsl(var(--gg-green))] hover:text-[hsl(var(--gg-green))]"
                              >
                                {r.name}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {getGalaxyGolfCategoryLabel(r.category)}
                            </TableCell>
                            <TableCell className="text-center">{r.rounds_played}</TableCell>
                            <TableCell className="text-center">{r.majors_played}</TableCell>
                            <TableCell className="text-center font-semibold text-[hsl(var(--gg-copper))]">
                              {r.points}
                            </TableCell>
                            <TableCell className="text-center">
                              {r.best_position ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Trophy className="h-3.5 w-3.5 text-[hsl(var(--gg-gold))]" />
                                  {r.best_position}º
                                  {r.best_was_major && (
                                    <Badge
                                      variant="outline"
                                      className="border-[hsl(var(--gg-copper))]/50 text-[hsl(var(--gg-copper))] text-[10px] px-1.5 py-0"
                                    >
                                      Major
                                    </Badge>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <p className="mt-6 text-xs text-muted-foreground italic">
                  Ranking de fase regular y Majors. Los Playoffs se implementarán en una fase posterior.
                </p>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </section>
    </>
  );
}
