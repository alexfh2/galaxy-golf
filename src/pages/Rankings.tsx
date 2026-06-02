import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
 * Rankings GalaxyGolf 2026
 * Lógica compartida + dos vistas independientes:
 *   - CircuitoRankingPage  (Stableford best 7 + bonus participación)
 *   - GalaxyCupRankingPage (puntos por posición Regular/Major)
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

interface HistoryItem {
  round_id: string;
  colLabel: string;
  colSort: number;
  fullLabel: string;
  stableford: number;
  isMajor?: boolean;
}

interface CircuitoRow {
  player_id: string;
  name: string;
  category: Category;
  firstHcp: number;
  rounds_played: number;
  best7: number;
  bonus: number;
  total: number;
  history: HistoryItem[];
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
  history: HistoryItem[];
}

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  if (!y || !m || !dd) return d;
  return `${dd}/${m}/${y}`;
}

function venueName(r: PublicResult): string {
  return (
    r.rounds?.club?.trim() ||
    r.rounds?.course?.trim() ||
    r.rounds?.name?.trim() ||
    '—'
  );
}

const CIRCUITO_STAGE_ORDER: Record<string, number> = { regular: 0, final: 1 };

function circuitoColumn(stage: string, n: number | null): { label: string; sort: number } {
  if (stage === 'final') return { label: 'Final', sort: 10_000 + (n ?? 0) };
  return { label: n ? `P${n}` : 'P?', sort: (CIRCUITO_STAGE_ORDER[stage] ?? 9) * 1000 + (n ?? 999) };
}

function galaxyCupColumn(stage: string, n: number | null): { label: string; sort: number } {
  if (stage === 'playoff') {
    return { label: n ? `PO${n}` : 'PO?', sort: 100_000 + (n ?? 999) };
  }
  return { label: n ? `P${n}` : 'P?', sort: n ?? 9999 };
}

function circuitoFullLabel(r: PublicResult, stage: string, n: number | null): string {
  const stageLabel = stage === 'final' ? 'Circuito Final' : `Circuito P${n ?? '?'}`;
  return [venueName(r), fmtDate(r.rounds?.date || r.play_date), stageLabel]
    .filter(Boolean)
    .join(' · ');
}

function galaxyCupFullLabel(r: PublicResult, stage: string, n: number | null): string {
  const parts = [venueName(r), fmtDate(r.rounds?.date || r.play_date)];
  if (stage === 'playoff') parts.push(`GalaxyCup PO${n ?? '?'}`);
  else parts.push(`GalaxyCup P${n ?? '?'}`);
  if (stage === 'major') parts.push('Major');
  return parts.filter(Boolean).join(' · ');
}

function computeCircuito(
  results: PublicResult[],
  roundComps: PublicRoundCompetition[],
): CircuitoRow[] {
  const circuitoAssoc = roundComps.filter(
    (rc) => rc.competition?.slug === 'circuito-galaxygolf',
  );
  const validRoundIds = new Set(
    circuitoAssoc
      .filter((rc) => rc.stage === 'regular' && rc.counts_for_ranking)
      .map((rc) => rc.round_id),
  );
  const circuitoMeta = new Map<string, { stage: string; n: number | null }>();
  for (const rc of circuitoAssoc) {
    circuitoMeta.set(rc.round_id, {
      stage: rc.stage,
      n: rc.competition_round_number ?? null,
    });
  }

  const filtered = results.filter(
    (r) => validRoundIds.has(r.round_id) && r.stableford_points != null,
  );

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

    const history: HistoryItem[] = list.map((r) => {
      const meta = circuitoMeta.get(r.round_id) ?? { stage: 'regular', n: null };
      const col = circuitoColumn(meta.stage, meta.n);
      return {
        round_id: r.round_id,
        colLabel: col.label,
        colSort: col.sort,
        fullLabel: circuitoFullLabel(r, meta.stage, meta.n),
        stableford: Number(r.stableford_points ?? 0),
      };
    });

    rows.push({
      player_id: pid,
      name: player.name,
      category,
      firstHcp,
      rounds_played: list.length,
      best7,
      bonus,
      total: best7 + bonus,
      history,
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
  const roundStage = new Map<string, 'regular' | 'major'>();
  const galaxyCupMeta = new Map<string, { stage: string; n: number | null }>();
  for (const rc of roundComps) {
    if (rc.competition?.slug !== 'galaxycup') continue;
    galaxyCupMeta.set(rc.round_id, {
      stage: rc.stage,
      n: rc.competition_round_number ?? null,
    });
    if (
      rc.counts_for_ranking &&
      (rc.stage === 'regular' || rc.stage === 'major')
    ) {
      roundStage.set(rc.round_id, rc.stage);
    }
  }

  const filtered = results.filter(
    (r) => roundStage.has(r.round_id) && r.stableford_points != null,
  );

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

  type Award = { points: number; position: number; isMajor: boolean; result: PublicResult };
  const awardsByPlayer = new Map<string, Award[]>();
  const majorsByPlayer = new Map<string, number>();

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

    const byCat: Record<Category, PublicResult[]> = { hcp_low: [], hcp_high: [] };
    for (const r of list) {
      const cat = playerCategory.get(r.player_id)!;
      byCat[cat].push(r);
    }

    for (const cat of ['hcp_low', 'hcp_high'] as Category[]) {
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
        arr.push({ points, position, isMajor, result: r });
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
    const history: HistoryItem[] = awards.map((a) => {
      const meta = galaxyCupMeta.get(a.result.round_id) ?? { stage: 'regular', n: null };
      const col = galaxyCupColumn(meta.stage, meta.n);
      return {
        round_id: a.result.round_id,
        colLabel: col.label,
        colSort: col.sort,
        fullLabel: `${galaxyCupFullLabel(a.result, meta.stage, meta.n)} · ${a.position}º · ${a.points} pts`,
        stableford: a.points,
        isMajor: a.isMajor,
      };
    });
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
      history,
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

type RoundCol = { round_id: string; label: string; sort: number; full: string; isMajor?: boolean };

function collectRounds(rows: { history: HistoryItem[] }[]): RoundCol[] {
  const map = new Map<string, RoundCol>();
  for (const r of rows) {
    for (const h of r.history) {
      if (!map.has(h.round_id)) {
        map.set(h.round_id, {
          round_id: h.round_id,
          label: h.colLabel,
          sort: h.colSort,
          full: h.fullLabel,
          isMajor: h.isMajor,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.sort - b.sort);
}

function CategoryTabs({
  category,
  onChange,
}: {
  category: Category;
  onChange: (c: Category) => void;
}) {
  return (
    <Tabs value={category} onValueChange={(v) => onChange(v as Category)} className="mb-8">
      <TabsList className="bg-[hsl(var(--gg-navy))]/60 border border-[hsl(var(--gg-gold))]/20 p-1 h-auto rounded-sm">
        <TabsTrigger
          value="hcp_low"
          className="text-[11px] uppercase tracking-[0.18em] px-5 py-2 rounded-none data-[state=active]:bg-[hsl(var(--gg-green))] data-[state=active]:text-[hsl(var(--gg-ivory))] data-[state=active]:shadow-none"
        >
          Hándicap Inferior
        </TabsTrigger>
        <TabsTrigger
          value="hcp_high"
          className="text-[11px] uppercase tracking-[0.18em] px-5 py-2 rounded-none data-[state=active]:bg-[hsl(var(--gg-green))] data-[state=active]:text-[hsl(var(--gg-ivory))] data-[state=active]:shadow-none"
        >
          Hándicap Superior
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function HeroStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="border-l border-[hsl(var(--gg-gold))]/25 pl-5">
      <div className="font-display text-3xl md:text-4xl text-[hsl(var(--gg-gold))] leading-none">
        {value}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--gg-ivory))]/55">
        {label}
      </div>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  text,
  stats,
}: {
  eyebrow: string;
  title: string;
  text: string;
  stats?: { value: React.ReactNode; label: string }[];
}) {
  return (
    <section className="relative overflow-hidden bg-[hsl(var(--gg-navy))] text-[hsl(var(--gg-ivory))] border-b border-[hsl(var(--gg-gold))]/15">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-[28rem] w-[28rem] rounded-full border border-[hsl(var(--gg-gold))]/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-10 h-72 w-72 rounded-full border border-[hsl(var(--gg-gold))]/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -left-24 h-[32rem] w-[32rem] rounded-full border border-[hsl(var(--gg-green))]/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--gg-green)/0.25),transparent_60%)]"
      />
      <div className="container relative mx-auto px-4 py-16 md:py-24">
        <p className="mb-5 text-[10px] font-medium tracking-[0.32em] text-[hsl(var(--gg-gold))]">
          {eyebrow}
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-light leading-[1.05] text-[hsl(var(--gg-ivory))]">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-base md:text-lg text-[hsl(var(--gg-ivory))]/70 font-light">
          {text}
        </p>
        {stats && stats.length > 0 && (
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 max-w-3xl">
            {stats.map((s, i) => (
              <HeroStat key={i} value={s.value} label={s.label} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============ Página: Circuito GalaxyGolf ============ */
export function CircuitoRankingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
  });
  const [category, setCategory] = useState<Category>('hcp_low');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const rows = useMemo(
    () => (data ? computeCircuito(data.results, data.round_competitions) : []),
    [data],
  );
  const filtered = rows.filter((r) => r.category === category);
  const roundCols = useMemo(() => collectRounds(filtered), [filtered]);

  const totalPruebas = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) for (const h of r.history) ids.add(h.round_id);
    return ids.size;
  }, [rows]);
  const leader = rows[0];

  const heroStats = rows.length
    ? [
        { value: leader ? leader.name.split(' ')[0] : '—', label: 'Líder actual' },
        { value: leader ? leader.total : '—', label: 'Puntos líder' },
        { value: totalPruebas, label: 'Pruebas disputadas' },
        { value: rows.length, label: 'Jugadores' },
      ]
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow="TEMPORADA 2026"
        title="Circuito GalaxyGolf 2026"
        text="Sigue tu temporada, suma en cada prueba y asegura tu camino a la Gran Final."
        stats={heroStats}
      />
      <section className="bg-background py-14">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <EmptyMessage>Cargando ranking...</EmptyMessage>
          ) : error ? (
            <EmptyMessage>No se ha podido cargar el ranking.</EmptyMessage>
          ) : (
            <>
              <CategoryTabs category={category} onChange={setCategory} />
              {rows.length === 0 ? (
                <EmptyMessage>
                  Todavía no hay resultados publicados del Circuito GalaxyGolf.
                </EmptyMessage>
              ) : filtered.length === 0 ? (
                <EmptyMessage>
                  No hay jugadores en la categoría {getGalaxyGolfCategoryLabel(category)} todavía.
                </EmptyMessage>
              ) : (
                <div className="rounded-sm border border-[hsl(var(--gg-gold))]/20 bg-[hsl(var(--gg-navy))]/40 overflow-x-auto shadow-[0_8px_40px_-20px_hsl(var(--gg-navy))]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[hsl(var(--gg-gold))]/20 hover:bg-transparent">
                        <TableHead className="w-14 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Pos.</TableHead>
                        <TableHead className="min-w-[180px] text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Jugador</TableHead>
                        {roundCols.map((c) => (
                          <TableHead
                            key={c.round_id}
                            title={c.full}
                            className="text-center whitespace-nowrap px-2 text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gg-ivory))]/55"
                          >
                            {c.label}
                          </TableHead>
                        ))}
                        <TableHead className="text-center text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Pruebas</TableHead>
                        <TableHead className="text-center text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Mejores 7</TableHead>
                        <TableHead className="text-center text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Bonus</TableHead>
                        <TableHead className="text-center text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-gold))]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r, i) => {
                        const byRid = new Map(r.history.map((h) => [h.round_id, h.stableford]));
                        const isLeader = i === 0;
                        return (
                          <TableRow
                            key={r.player_id}
                            className={`group border-b border-[hsl(var(--gg-gold))]/10 ${
                              isLeader ? 'bg-[hsl(var(--gg-green))]/20 hover:bg-[hsl(var(--gg-green))]/25' : 'hover:bg-[hsl(var(--gg-navy))]/60'
                            }`}
                          >
                            <TableCell className="font-display text-lg text-[hsl(var(--gg-gold))]">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerId(r.player_id)}
                                className="font-medium text-left text-[hsl(var(--gg-ivory))] transition-colors hover:text-[hsl(var(--gg-gold))]"
                              >
                                {r.name}
                              </button>
                            </TableCell>
                            {roundCols.map((c) => {
                              const v = byRid.get(c.round_id);
                              return (
                                <TableCell key={c.round_id} className="text-center px-2 text-sm text-[hsl(var(--gg-ivory))]/85">
                                  {v != null ? v : <span className="text-[hsl(var(--gg-ivory))]/25">—</span>}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center text-[hsl(var(--gg-ivory))]/75">{r.rounds_played}</TableCell>
                            <TableCell className="text-center text-[hsl(var(--gg-ivory))]/85">{r.best7}</TableCell>
                            <TableCell className="text-center text-[hsl(var(--gg-copper))]">+{r.bonus}</TableCell>
                            <TableCell className="text-center font-display text-lg text-[hsl(var(--gg-gold))]">
                              {r.total}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/45">
                Ranking regular provisional · La Gran Final se implementará en una fase posterior.
              </p>
            </>
          )}
        </div>
      </section>
      <PlayerProfileDialog
        playerId={selectedPlayerId}
        open={!!selectedPlayerId}
        onOpenChange={(o) => !o && setSelectedPlayerId(null)}
      />
    </>
  );
}

/* ============ Página: GalaxyCup ============ */
export function GalaxyCupRankingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
  });
  const [category, setCategory] = useState<Category>('hcp_low');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const rows = useMemo(
    () => (data ? computeGalaxyCup(data.results, data.round_competitions) : []),
    [data],
  );
  const filtered = rows.filter((r) => r.category === category);
  const roundCols = useMemo(() => collectRounds(filtered), [filtered]);

  const { totalPruebas, totalMajors } = useMemo(() => {
    const ids = new Set<string>();
    const majors = new Set<string>();
    for (const r of rows) {
      for (const h of r.history) {
        ids.add(h.round_id);
        if (h.isMajor) majors.add(h.round_id);
      }
    }
    return { totalPruebas: ids.size, totalMajors: majors.size };
  }, [rows]);
  const leader = rows[0];

  const heroStats = rows.length
    ? [
        { value: leader ? leader.name.split(' ')[0] : '—', label: 'Líder actual' },
        { value: leader ? leader.points : '—', label: 'Puntos líder' },
        { value: totalPruebas, label: 'Pruebas disputadas' },
        { value: totalMajors, label: 'Majors jugados' },
      ]
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow="RACE TO THE PLAYOFFS"
        title="GalaxyCup 2026"
        text="Cada torneo cuenta. Solo los mejores avanzan hacia los Playoffs."
        stats={heroStats}
      />
      <section className="bg-background py-14">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <EmptyMessage>Cargando ranking...</EmptyMessage>
          ) : error ? (
            <EmptyMessage>No se ha podido cargar el ranking.</EmptyMessage>
          ) : (
            <>
              <CategoryTabs category={category} onChange={setCategory} />
              {rows.length === 0 ? (
                <EmptyMessage>
                  Todavía no hay resultados publicados de la GalaxyCup.
                </EmptyMessage>
              ) : filtered.length === 0 ? (
                <EmptyMessage>
                  No hay jugadores en la categoría {getGalaxyGolfCategoryLabel(category)} todavía.
                </EmptyMessage>
              ) : (
                <div className="rounded-sm border border-[hsl(var(--gg-gold))]/20 bg-[hsl(var(--gg-navy))]/40 overflow-x-auto shadow-[0_8px_40px_-20px_hsl(var(--gg-navy))]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[hsl(var(--gg-gold))]/20 hover:bg-transparent">
                        <TableHead className="w-14 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Pos.</TableHead>
                        <TableHead className="min-w-[180px] text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Jugador</TableHead>
                        {roundCols.map((c) => (
                          <TableHead
                            key={c.round_id}
                            title={c.full}
                            className="text-center whitespace-nowrap px-2 text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gg-ivory))]/55"
                          >
                            {c.label}
                            {c.isMajor && (
                              <span className="ml-1 inline-block text-[9px] uppercase tracking-[0.1em] text-[hsl(var(--gg-copper))] border border-[hsl(var(--gg-copper))]/50 px-1 leading-none py-[2px]">
                                M
                              </span>
                            )}
                          </TableHead>
                        ))}
                        <TableHead className="text-center text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Pruebas</TableHead>
                        <TableHead className="text-center text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Majors</TableHead>
                        <TableHead className="text-center text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-gold))]">Puntos</TableHead>
                        <TableHead className="text-center text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/60">Mejor resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r, i) => {
                        const byRid = new Map(r.history.map((h) => [h.round_id, h.stableford]));
                        const isLeader = i === 0;
                        return (
                          <TableRow
                            key={r.player_id}
                            className={`group border-b border-[hsl(var(--gg-gold))]/10 ${
                              isLeader ? 'bg-[hsl(var(--gg-green))]/20 hover:bg-[hsl(var(--gg-green))]/25' : 'hover:bg-[hsl(var(--gg-navy))]/60'
                            }`}
                          >
                            <TableCell className="font-display text-lg text-[hsl(var(--gg-gold))]">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerId(r.player_id)}
                                className="font-medium text-left text-[hsl(var(--gg-ivory))] transition-colors hover:text-[hsl(var(--gg-gold))]"
                              >
                                {r.name}
                              </button>
                            </TableCell>
                            {roundCols.map((c) => {
                              const v = byRid.get(c.round_id);
                              return (
                                <TableCell key={c.round_id} className="text-center px-2 text-sm text-[hsl(var(--gg-ivory))]/85">
                                  {v != null && v > 0 ? v : <span className="text-[hsl(var(--gg-ivory))]/25">—</span>}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center text-[hsl(var(--gg-ivory))]/75">{r.rounds_played}</TableCell>
                            <TableCell className="text-center text-[hsl(var(--gg-ivory))]/75">{r.majors_played}</TableCell>
                            <TableCell className="text-center font-display text-lg text-[hsl(var(--gg-gold))]">
                              {r.points}
                            </TableCell>
                            <TableCell className="text-center">
                              {r.best_position ? (
                                <span className="inline-flex items-center gap-1.5 text-[hsl(var(--gg-ivory))]/85">
                                  <Trophy className="h-3.5 w-3.5 text-[hsl(var(--gg-gold))]" />
                                  {r.best_position}º
                                  {r.best_was_major && (
                                    <Badge
                                      variant="outline"
                                      className="border-[hsl(var(--gg-copper))]/50 text-[hsl(var(--gg-copper))] text-[10px] px-1.5 py-0 rounded-none"
                                    >
                                      Major
                                    </Badge>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[hsl(var(--gg-ivory))]/25">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="mt-6 text-xs text-muted-foreground italic">
                Ranking de fase regular y Majors. Los Playoffs se implementarán en una fase posterior.
              </p>
            </>
          )}
        </div>
      </section>
      <PlayerProfileDialog
        playerId={selectedPlayerId}
        open={!!selectedPlayerId}
        onOpenChange={(o) => !o && setSelectedPlayerId(null)}
      />
    </>
  );
}

/* Default export: alias antiguo /rankings → redirige a Circuito. */
export default function Rankings() {
  return <Navigate to="/circuito-galaxygolf" replace />;
}
