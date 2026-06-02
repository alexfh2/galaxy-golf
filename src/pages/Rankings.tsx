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
import heroCircuito from '@/assets/hero-circuito.jpg';
import heroGalaxyCup from '@/assets/hero-galaxycup.jpg';

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
  lastHcp: number | null;
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
  lastHcp: number | null;
  rounds_played: number;
  majors_played: number;
  points: number;
  best_position: number | null;
  best_was_major: boolean;
  history: HistoryItem[];
}

/** Último hándicap conocido en la lista de resultados del jugador (informativo). */
function computeLastHcp(list: PublicResult[]): number | null {
  const sortedDesc = [...list].sort((a, b) =>
    sortKey(b).localeCompare(sortKey(a)),
  );
  const found = sortedDesc.find((r) => r.handicap_at_round != null);
  if (!found) return null;
  const n = Number(found.handicap_at_round);
  return Number.isFinite(n) ? n : null;
}

/** Formato español con coma decimal y un decimal: 10,1 */
function fmtHcp(h: number | null): string | null {
  if (h == null || !Number.isFinite(h)) return null;
  return h.toFixed(1).replace('.', ',');
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
      lastHcp: computeLastHcp(list),
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
      lastHcp: computeLastHcp(byPlayerAll.get(pid) ?? []),
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
  accent = 'green',
}: {
  category: Category;
  onChange: (c: Category) => void;
  accent?: 'green' | 'copper';
}) {
  const activeBg =
    accent === 'copper'
      ? 'data-[state=active]:bg-[hsl(var(--gg-copper))] data-[state=active]:text-[hsl(var(--gg-surface-light))]'
      : 'data-[state=active]:bg-[hsl(var(--gg-green))] data-[state=active]:text-[hsl(var(--gg-surface-light))]';
  const inactive = 'text-[hsl(var(--gg-navy-deep))]/65 hover:text-[hsl(var(--gg-navy-deep))]';
  return (
    <Tabs value={category} onValueChange={(v) => onChange(v as Category)} className="mb-8">
      <TabsList className="bg-[hsl(var(--gg-surface-light))] border border-[hsl(var(--gg-navy-deep))]/12 p-1 h-auto rounded-sm shadow-[0_2px_10px_-6px_rgba(11,19,36,0.18)]">
        <TabsTrigger
          value="hcp_low"
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] px-5 py-2 rounded-none data-[state=active]:shadow-none ${inactive} ${activeBg}`}
        >
          Hándicap Inferior
        </TabsTrigger>
        <TabsTrigger
          value="hcp_high"
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] px-5 py-2 rounded-none data-[state=active]:shadow-none ${inactive} ${activeBg}`}
        >
          Hándicap Superior
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

type Accent = 'green' | 'copper';

function LeaderCard({
  name,
  points,
  categoryLabel,
  accent,
}: {
  name: string | null;
  points: number | null;
  categoryLabel: string;
  accent: Accent;
}) {
  const accentColor = accent === 'green' ? 'hsl(var(--gg-green))' : 'hsl(var(--gg-copper))';
  return (
    <div
      className="relative w-full max-w-sm border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))]/95 backdrop-blur-md p-7 shadow-[0_24px_60px_-24px_rgba(11,19,36,0.35)]"
      style={{ borderTop: `2px solid ${accentColor}` }}
    >
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] uppercase tracking-[0.28em] text-[hsl(var(--gg-navy-deep))]/55">
          Líder actual
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.22em] px-2 py-[2px] border"
          style={{ color: accentColor, borderColor: accentColor + '55' }}
        >
          #1
        </span>
      </div>
      {name ? (
        <>
          <div className="font-display text-2xl md:text-[26px] leading-tight text-[hsl(var(--gg-navy-deep))]">
            {name}
          </div>
          <div className="mt-5 flex items-end justify-between border-t border-[hsl(var(--gg-navy-deep))]/10 pt-4">
            <div>
              <div className="text-[9px] uppercase tracking-[0.28em] text-[hsl(var(--gg-navy-deep))]/50">
                Categoría
              </div>
              <div className="mt-1 text-[12px] uppercase tracking-[0.18em] text-[hsl(var(--gg-navy-deep))]/85">
                {categoryLabel}
              </div>
            </div>
            <div className="text-right">
              <div
                className="font-display text-3xl leading-none"
                style={{ color: accentColor }}
              >
                {points}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.28em] text-[hsl(var(--gg-navy-deep))]/55">
                pts
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="py-4">
          <div className="font-display text-xl text-[hsl(var(--gg-navy-deep))]/70">Ranking pendiente</div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--gg-navy-deep))]/50">
            Sin resultados en {categoryLabel}
          </div>
        </div>
      )}
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  text,
  bgImage,
  leaderCard,
  overlayStrength = 'soft',
}: {
  eyebrow: string;
  title: React.ReactNode;
  text: string;
  bgImage?: string;
  leaderCard?: React.ReactNode;
  overlayStrength?: 'soft' | 'strong';
}) {
  const isStrong = overlayStrength === 'strong';
  return (
    <section className="relative overflow-hidden bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))] border-b border-[hsl(var(--gg-gold))]/20">
      {bgImage && (
        <>
          <img
            src={bgImage}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />
          {/* Capa lateral marfil — apoyo del titular */}
          <div
            aria-hidden
            className={`absolute inset-0 bg-gradient-to-r ${
              isStrong
                ? 'from-[hsl(var(--gg-bg-light))]/97 from-0% via-[hsl(var(--gg-bg-light))]/82 via-45% to-[hsl(var(--gg-bg-light))]/28 to-100%'
                : 'from-[hsl(var(--gg-bg-light))]/95 from-0% via-[hsl(var(--gg-bg-light))]/72 via-45% to-[hsl(var(--gg-bg-light))]/18 to-100%'
            }`}
          />
          {/* Velo superior suave */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[hsl(var(--gg-bg-light))]/55 to-transparent"
          />
          {/* Fundido inferior */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--gg-bg-light))] via-transparent to-transparent"
          />
          {/* Refuerzo localizado bajo el bloque titular */}
          <div
            aria-hidden
            className={`absolute inset-y-0 left-0 ${isStrong ? 'w-[60%]' : 'w-[52%]'} bg-gradient-to-r from-[hsl(var(--gg-bg-light))]/55 to-transparent`}
          />
        </>
      )}
      {/* grafismos circulares eliminados — pedido cliente: hero más limpio */}
      <div className="container relative mx-auto px-4 py-12 md:py-16">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-end">
          <div>
            <p className="mb-5 text-[10px] font-semibold tracking-[0.32em] text-[hsl(var(--gg-green))]">
              {eyebrow}
            </p>
            <h1
              className="font-display font-light leading-[1.05] text-[hsl(var(--gg-navy-deep))]"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}
            >
              {title}
            </h1>
            <p className="mt-6 max-w-xl text-base md:text-lg text-[hsl(var(--gg-navy-deep))]/80 font-light">
              {text}
            </p>
          </div>
          {leaderCard && (
            <div className="flex lg:justify-end">{leaderCard}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function DashboardCard({
  label,
  value,
  hint,
  accent = 'gold',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: 'gold' | 'copper' | 'green' | 'muted';
}) {
  const valueColor =
    accent === 'copper'
      ? 'text-[hsl(var(--gg-copper))]'
      : accent === 'green'
      ? 'text-[hsl(var(--gg-green))]'
      : accent === 'muted'
      ? 'text-[hsl(var(--gg-navy-deep))]'
      : 'text-[hsl(var(--gg-navy-deep))]';
  return (
    <div className="border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] p-6 shadow-[0_6px_24px_-16px_rgba(11,19,36,0.25)] transition-colors hover:border-[hsl(var(--gg-green))]/45">
      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--gg-green))]">
        {label}
      </div>
      <div className={`mt-3 font-display text-3xl md:text-[34px] leading-none ${valueColor}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-3 text-[11px] tracking-wide text-[hsl(var(--gg-navy-deep))]/65">
          {hint}
        </div>
      )}
    </div>
  );
}

function DashboardStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4 -mt-10 md:-mt-14 relative z-10 mb-16">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">{children}</div>
    </div>
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
  const categoryLabel = getGalaxyGolfCategoryLabel(category);
  const leader = filtered[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="TEMPORADA 2026"
        title={
          <>
            Circuito GalaxyGolf
            <span className="block text-[hsl(var(--gg-gold))]/90">2026</span>
          </>
        }
        text="Sigue tu temporada, suma en cada prueba y asegura tu camino a la Gran Final."
        bgImage={heroCircuito}
        leaderCard={
          <LeaderCard
            name={leader?.name ?? null}
            points={leader?.total ?? null}
            categoryLabel={categoryLabel}
            accent="green"
          />
        }
      />
      <DashboardStrip>
        <DashboardCard
          label="Pruebas puntuables"
          value={totalPruebas || '—'}
          hint="Jornadas con resultados publicadas"
        />
        <DashboardCard
          label="Jugadores en ranking"
          value={filtered.length || '—'}
          hint={categoryLabel}
        />
        <DashboardCard
          label="Sistema de puntuación"
          value="Mejores 7"
          hint="Suma de los 7 mejores resultados"
          accent="muted"
        />
        <DashboardCard
          label="Gran Final"
          value="Pendiente"
          hint="Por confirmar"
          accent="muted"
        />
      </DashboardStrip>
      <section className="bg-background pb-14">
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
                <div className="rounded-sm border border-[hsl(var(--gg-navy-deep))]/14 bg-[hsl(var(--gg-surface-light))] overflow-x-auto shadow-[0_10px_36px_-22px_rgba(11,19,36,0.35)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[hsl(var(--gg-navy-deep))]/14 bg-[hsl(var(--gg-bg-light))] hover:bg-[hsl(var(--gg-bg-light))]">
                        <TableHead className="w-14 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--gg-green))]">Pos.</TableHead>
                        <TableHead className="min-w-[180px] text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--gg-green))]">Jugador</TableHead>
                        {roundCols.map((c) => (
                          <TableHead
                            key={c.round_id}
                            title={c.full}
                            className="text-center whitespace-nowrap px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[hsl(var(--gg-green))]/85"
                          >
                            {c.label}
                          </TableHead>
                        ))}
                        <TableHead className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--gg-green))]">Pruebas</TableHead>
                        <TableHead className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--gg-green))]">Mejores 7</TableHead>
                        <TableHead className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--gg-green))]">Bonus</TableHead>
                        <TableHead className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--gg-copper))]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r, i) => {
                        const byRid = new Map(r.history.map((h) => [h.round_id, h.stableford]));
                        const isLeader = i === 0;
                        return (
                          <TableRow
                            key={r.player_id}
                            className={`group border-b border-[hsl(var(--gg-navy-deep))]/8 ${
                              isLeader
                                ? 'bg-[hsl(var(--gg-green))]/10 hover:bg-[hsl(var(--gg-green))]/14'
                                : 'hover:bg-[hsl(var(--gg-bg-light))]'
                            }`}
                          >
                            <TableCell className="font-semibold text-base text-[hsl(var(--gg-navy-deep))]/85">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerId(r.player_id)}
                                className="font-medium text-left text-[hsl(var(--gg-navy-deep))] transition-colors hover:text-[hsl(var(--gg-green))]"
                              >
                                {r.name}
                              </button>
                            </TableCell>
                            {roundCols.map((c) => {
                              const v = byRid.get(c.round_id);
                              return (
                                <TableCell key={c.round_id} className="text-center px-2 text-sm text-[hsl(var(--gg-navy-deep))]/85">
                                  {v != null ? v : <span className="text-[hsl(var(--gg-navy-deep))]/25">—</span>}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center text-sm text-[hsl(var(--gg-navy-deep))]/80">{r.rounds_played}</TableCell>
                            <TableCell className="text-center text-sm text-[hsl(var(--gg-navy-deep))]/80">{r.best7}</TableCell>
                            <TableCell className="text-center text-sm text-[hsl(var(--gg-navy-deep))]/80">+{r.bonus}</TableCell>
                            <TableCell className="text-center font-sans font-bold text-[hsl(var(--gg-copper))] tabular-nums text-sm">
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
  const categoryLabel = getGalaxyGolfCategoryLabel(category);
  const leader = filtered[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="RACE TO THE PLAYOFFS"
        title={
          <>
            GalaxyCup
            <span className="block text-[hsl(var(--gg-copper))]/95">2026</span>
          </>
        }
        text="Cada torneo cuenta. Solo los mejores avanzan hacia los Playoffs."
        bgImage={heroGalaxyCup}
        overlayStrength="strong"
        leaderCard={
          <LeaderCard
            name={leader?.name ?? null}
            points={leader?.points ?? null}
            categoryLabel={categoryLabel}
            accent="copper"
          />
        }
      />
      <DashboardStrip>
        <DashboardCard
          label="Jugadores en ranking"
          value={filtered.length || '—'}
          hint={categoryLabel}
        />
        <DashboardCard
          label="Pruebas puntuables"
          value={totalPruebas || '—'}
          hint="Jornadas con resultados publicadas"
        />
        <DashboardCard
          label="Majors puntuables"
          value={totalMajors || '—'}
          hint="Puntuación mayor en torneos especiales"
          accent="copper"
        />
        <DashboardCard
          label="Ruta a Playoffs"
          value="Fase regular"
          hint="En curso"
          accent="muted"
        />
      </DashboardStrip>
      <section className="bg-background pb-14">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <EmptyMessage>Cargando ranking...</EmptyMessage>
          ) : error ? (
            <EmptyMessage>No se ha podido cargar el ranking.</EmptyMessage>
          ) : (
            <>
              <CategoryTabs category={category} onChange={setCategory} accent="copper" />
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
              <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--gg-ivory))]/45">
                Ranking de fase regular y Majors · Los Playoffs se implementarán en una fase posterior.
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
