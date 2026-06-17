import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import type {
  PublicCircuitData,
  PublicResult,
  PublicRoundCompetition,
} from '@/lib/publicCircuitData';
import {
  getGalaxyGolfCategoryByHandicap,
  getGalaxyGolfCategoryLabel,
} from '@/lib/playerCategoryHandicap';

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

function fmtHcp(h: number | null | undefined): string | null {
  if (h == null || !Number.isFinite(Number(h))) return null;
  return Number(h).toFixed(1).replace('.', ',');
}

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  if (!y || !m || !dd) return d;
  return `${dd}/${m}/${y}`;
}

function venueName(r?: PublicResult['rounds'] | null | { name?: string | null; course?: string | null; club?: string | null }): string {
  return (
    (r as any)?.club?.trim() ||
    (r as any)?.course?.trim() ||
    (r as any)?.name?.trim() ||
    'Sede por confirmar'
  );
}

type RoundMetaInfo = { name: string | null; course: string | null; club: string | null; date: string | null };

function useRoundsMetaMap() {
  return useQuery({
    queryKey: ['public-rounds-meta-map'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rounds')
        .select('id, name, course, club, date');
      const map = new Map<string, RoundMetaInfo>();
      (data ?? []).forEach((r: any) => {
        map.set(r.id, { name: r.name ?? null, course: r.course ?? null, club: r.club ?? null, date: r.date ?? null });
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

function enrichRoundsMeta<T extends { round: { round_id: string; name: string; date: string | null } }>(
  items: T[],
  meta: Map<string, RoundMetaInfo> | undefined,
): T[] {
  if (!meta) return items;
  return items.map((it) => {
    const m = meta.get(it.round.round_id);
    if (!m) return it;
    const fallbackName = venueName(m);
    return {
      ...it,
      round: {
        ...it.round,
        name: it.round.name && it.round.name !== '—' && it.round.name !== 'Sede por confirmar' ? it.round.name : fallbackName,
        date: it.round.date ?? m.date ?? null,
      },
    };
  });
}

function splitPlayedPending<T extends { round: { date: string | null }; rowsByCat: { hcp_low: unknown[]; hcp_high: unknown[] } }>(items: T[]): { played: T[]; pending: T[] } {
  const played: T[] = [];
  const pending: T[] = [];
  for (const it of items) {
    const total = it.rowsByCat.hcp_low.length + it.rowsByCat.hcp_high.length;
    if (total > 0) played.push(it);
    else pending.push(it);
  }
  // Played: most recent first
  played.sort((a, b) => (b.round.date ?? '').localeCompare(a.round.date ?? ''));
  // Pending: nearest first; rounds without date go last
  pending.sort((a, b) => {
    const da = a.round.date ?? '';
    const db = b.round.date ?? '';
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  });
  return { played, pending };
}

function SectionDivider({ label, accent }: { label: string; accent: 'green' | 'copper' }) {
  const color = accent === 'copper' ? 'hsl(var(--gg-copper))' : 'hsl(var(--gg-green))';
  return (
    <div className="flex items-center gap-3 my-4">
      <span className="h-px flex-1" style={{ background: `${color}33` }} />
      <span
        className="text-[10px] font-semibold tracking-[0.28em] uppercase"
        style={{ color }}
      >
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: `${color}33` }} />
    </div>
  );
}

function statusLabel(s: string | null | undefined): string {
  switch (s ?? 'completed') {
    case 'completed': return 'Jugado';
    case 'retired': return 'Retirado';
    case 'no_show': return 'No presentado';
    case 'disqualified': return 'Descalificado';
    default: return s ?? 'Jugado';
  }
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? 'completed';
  const cls =
    s === 'completed'
      ? 'border-[hsl(var(--gg-green))]/45 text-[hsl(var(--gg-green))]'
      : s === 'retired'
      ? 'border-[hsl(var(--gg-copper))]/50 text-[hsl(var(--gg-copper))]'
      : 'border-[hsl(var(--gg-navy-deep))]/30 text-[hsl(var(--gg-navy-deep))]/65';
  return (
    <Badge
      variant="outline"
      className={`${cls} text-[10px] px-1.5 py-0 rounded-none`}
    >
      {statusLabel(s)}
    </Badge>
  );
}

interface RoundMeta {
  round_id: string;
  label: string;
  fullLabel: string;
  date: string | null;
  name: string;
  stage: string;
  n: number | null;
  isMajor?: boolean;
  sort: number;
}

/* ===== CIRCUITO ===== */

function circuitoLabel(stage: string, n: number | null): { label: string; sort: number } {
  if (stage === 'final') return { label: 'Final', sort: 10_000 + (n ?? 0) };
  return { label: n ? `P${n}` : 'P?', sort: n ?? 9999 };
}

type CircuitoBreakdownRow = {
  player_id: string;
  name: string;
  category: Category;
  handicap: number | null;
  stableford: number;
  status: string;
  bonus: number;
  contribution: number;
};

export function buildCircuitoRoundBreakdown(data: PublicCircuitData): {
  round: RoundMeta;
  rowsByCat: Record<Category, CircuitoBreakdownRow[]>;
}[] {
  const { results, round_competitions } = data;

  // Rounds associated to circuito-galaxygolf and counted.
  const assocByRound = new Map<string, PublicRoundCompetition>();
  for (const rc of round_competitions) {
    if (rc.competition?.slug !== 'circuito-galaxygolf') continue;
    if (!rc.counts_for_ranking) continue;
    assocByRound.set(rc.round_id, rc);
  }

  // Build set of all results that "count" for category fixing
  // (same as computeCircuito: regular + counts_for_ranking, excl no_show/disqualified).
  const regularCircuito = new Set<string>();
  for (const [rid, rc] of assocByRound.entries()) {
    if (rc.stage === 'regular') regularCircuito.add(rid);
  }
  const forCategory = results.filter(
    (r) =>
      regularCircuito.has(r.round_id) &&
      (r.result_status ?? 'completed') !== 'no_show' &&
      (r.result_status ?? 'completed') !== 'disqualified',
  );

  // First HCP per player → category fixed.
  const playerCategory = new Map<string, Category>();
  const byPlayer = new Map<string, PublicResult[]>();
  for (const r of forCategory) {
    const arr = byPlayer.get(r.player_id) ?? [];
    arr.push(r);
    byPlayer.set(r.player_id, arr);
  }
  for (const [pid, list] of byPlayer.entries()) {
    const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const firstHcp = Number(
      sorted.find((r) => r.handicap_at_round != null)?.handicap_at_round ?? NaN,
    );
    const cat = getGalaxyGolfCategoryByHandicap(firstHcp);
    if (cat) playerCategory.set(pid, cat);
  }

  // Build rounds list.
  const rounds: RoundMeta[] = [];
  for (const [rid, rc] of assocByRound.entries()) {
    const sampleResult = results.find((r) => r.round_id === rid);
    const roundInfo = sampleResult?.rounds;
    const { label, sort } = circuitoLabel(rc.stage, rc.competition_round_number ?? null);
    rounds.push({
      round_id: rid,
      label,
      fullLabel: `Circuito ${label}`,
      date: roundInfo?.date ?? sampleResult?.play_date ?? null,
      name: venueName(roundInfo),
      stage: rc.stage,
      n: rc.competition_round_number ?? null,
      sort,
    });
  }
  rounds.sort((a, b) => a.sort - b.sort);

  const out: { round: RoundMeta; rowsByCat: Record<Category, CircuitoBreakdownRow[]> }[] = [];

  for (const round of rounds) {
    const resultsThisRound = results.filter((r) => r.round_id === round.round_id);
    const rowsByCat: Record<Category, CircuitoBreakdownRow[]> = { hcp_low: [], hcp_high: [] };

    for (const r of resultsThisRound) {
      const status = (r.result_status ?? 'completed') as string;
      const player = r.players_public;
      if (!player) continue;

      // Determine category: fixed from first circuito round if available, otherwise this round's HCP.
      let cat: Category | null = playerCategory.get(r.player_id) ?? null;
      if (!cat) {
        cat = getGalaxyGolfCategoryByHandicap(
          r.handicap_at_round != null ? Number(r.handicap_at_round) : null,
        );
      }
      if (!cat) continue;

      const stable =
        status === 'completed' ? Number(r.stableford_points ?? 0) : 0;
      const bonus = status === 'no_show' || status === 'disqualified' ? 0 : 1;
      const contribution = stable + bonus;

      rowsByCat[cat].push({
        player_id: r.player_id,
        name: player.name,
        category: cat,
        handicap: r.handicap_at_round != null ? Number(r.handicap_at_round) : null,
        stableford: stable,
        status,
        bonus,
        contribution,
      });
    }

    for (const cat of ['hcp_low', 'hcp_high'] as Category[]) {
      rowsByCat[cat].sort((a, b) => {
        if (b.stableford !== a.stableford) return b.stableford - a.stableford;
        const ha = a.handicap ?? 9999;
        const hb = b.handicap ?? 9999;
        if (ha !== hb) return ha - hb;
        return a.name.localeCompare(b.name, 'es');
      });
    }

    out.push({ round, rowsByCat });
  }

  return out;
}

/* ===== GALAXYCUP ===== */

function galaxyCupLabel(stage: string, n: number | null): { label: string; sort: number; isMajor: boolean } {
  if (stage === 'playoff') return { label: n ? `PO${n}` : 'PO?', sort: 100_000 + (n ?? 999), isMajor: false };
  if (stage === 'major') return { label: n ? `P${n} · Major` : 'P? · Major', sort: n ?? 9999, isMajor: true };
  return { label: n ? `P${n}` : 'P?', sort: n ?? 9999, isMajor: false };
}

type GalaxyCupBreakdownRow = {
  player_id: string;
  name: string;
  category: Category;
  handicap: number | null;
  stableford: number;
  status: string;
  position: number | null;
  points: number;
  isMajor: boolean;
};

export function buildGalaxyCupRoundBreakdown(data: PublicCircuitData): {
  round: RoundMeta;
  rowsByCat: Record<Category, GalaxyCupBreakdownRow[]>;
}[] {
  const { results, round_competitions } = data;

  const assocByRound = new Map<string, PublicRoundCompetition>();
  for (const rc of round_competitions) {
    if (rc.competition?.slug !== 'galaxycup') continue;
    if (!rc.counts_for_ranking) continue;
    if (rc.stage !== 'regular' && rc.stage !== 'major' && rc.stage !== 'playoff') continue;
    assocByRound.set(rc.round_id, rc);
  }

  // Category fixed by first GalaxyCup round (completed) — same logic as computeGalaxyCup.
  const forCategory = results.filter(
    (r) =>
      assocByRound.has(r.round_id) &&
      r.stableford_points != null &&
      (r.result_status ?? 'completed') === 'completed',
  );
  const byPlayer = new Map<string, PublicResult[]>();
  for (const r of forCategory) {
    const arr = byPlayer.get(r.player_id) ?? [];
    arr.push(r);
    byPlayer.set(r.player_id, arr);
  }
  const playerCategory = new Map<string, Category>();
  for (const [pid, list] of byPlayer.entries()) {
    const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const firstHcp = Number(
      sorted.find((r) => r.handicap_at_round != null)?.handicap_at_round ?? NaN,
    );
    const cat = getGalaxyGolfCategoryByHandicap(firstHcp);
    if (cat) playerCategory.set(pid, cat);
  }

  const rounds: RoundMeta[] = [];
  for (const [rid, rc] of assocByRound.entries()) {
    const sampleResult = results.find((r) => r.round_id === rid);
    const roundInfo = sampleResult?.rounds;
    const { label, sort, isMajor } = galaxyCupLabel(rc.stage, rc.competition_round_number ?? null);
    rounds.push({
      round_id: rid,
      label,
      fullLabel: `GalaxyCup ${label}`,
      date: roundInfo?.date ?? sampleResult?.play_date ?? null,
      name: venueName(roundInfo),
      stage: rc.stage,
      n: rc.competition_round_number ?? null,
      isMajor,
      sort,
    });
  }
  rounds.sort((a, b) => a.sort - b.sort);

  const out: { round: RoundMeta; rowsByCat: Record<Category, GalaxyCupBreakdownRow[]> }[] = [];

  for (const round of rounds) {
    const isMajor = round.stage === 'major';
    const table = isMajor ? GALAXYCUP_MAJOR_POINTS : GALAXYCUP_REGULAR_POINTS;
    const resultsThisRound = results.filter((r) => r.round_id === round.round_id);

    const rowsByCat: Record<Category, GalaxyCupBreakdownRow[]> = { hcp_low: [], hcp_high: [] };

    // First pass: assign category for each result.
    type Prep = {
      r: PublicResult;
      cat: Category;
      status: string;
      stableford: number;
    };
    const prep: Prep[] = [];
    for (const r of resultsThisRound) {
      if (!r.players_public) continue;
      const status = (r.result_status ?? 'completed') as string;
      let cat = playerCategory.get(r.player_id) ?? null;
      if (!cat) {
        cat = getGalaxyGolfCategoryByHandicap(
          r.handicap_at_round != null ? Number(r.handicap_at_round) : null,
        );
      }
      if (!cat) continue;
      const stable = status === 'completed' ? Number(r.stableford_points ?? 0) : 0;
      prep.push({ r, cat, status, stableford: stable });
    }

    for (const cat of ['hcp_low', 'hcp_high'] as Category[]) {
      const inCat = prep.filter((p) => p.cat === cat);
      // Only completed players enter the point distribution and get positions.
      const completed = inCat
        .filter((p) => p.status === 'completed')
        .sort((a, b) => {
          if (b.stableford !== a.stableford) return b.stableford - a.stableford;
          const ha = a.r.handicap_at_round;
          const hb = b.r.handicap_at_round;
          const va = ha != null && !Number.isNaN(Number(ha));
          const vb = hb != null && !Number.isNaN(Number(hb));
          if (va && vb) {
            const na = Number(ha);
            const nb = Number(hb);
            if (na !== nb) return na - nb;
          } else if (va !== vb) {
            return va ? -1 : 1;
          }
          return (a.r.players_public?.name ?? '').localeCompare(
            b.r.players_public?.name ?? '',
            'es',
          );
        });

      completed.forEach((p, idx) => {
        const position = idx + 1;
        const points = position <= 20 ? table[position - 1] : 0;
        rowsByCat[cat].push({
          player_id: p.r.player_id,
          name: p.r.players_public!.name,
          category: cat,
          handicap: p.r.handicap_at_round != null ? Number(p.r.handicap_at_round) : null,
          stableford: p.stableford,
          status: p.status,
          position,
          points,
          isMajor,
        });
      });

      // Non-completed go after, with no position/points, sorted by name.
      const others = inCat
        .filter((p) => p.status !== 'completed')
        .sort((a, b) =>
          (a.r.players_public?.name ?? '').localeCompare(b.r.players_public?.name ?? '', 'es'),
        );
      for (const p of others) {
        rowsByCat[cat].push({
          player_id: p.r.player_id,
          name: p.r.players_public!.name,
          category: cat,
          handicap: p.r.handicap_at_round != null ? Number(p.r.handicap_at_round) : null,
          stableford: 0,
          status: p.status,
          position: null,
          points: 0,
          isMajor,
        });
      }
    }

    out.push({ round, rowsByCat });
  }

  return out;
}

/* ===== UI ===== */

function CatSwitcher({
  value,
  onChange,
  accent,
}: {
  value: Category;
  onChange: (c: Category) => void;
  accent: 'green' | 'copper';
}) {
  const activeBg =
    accent === 'copper'
      ? 'data-[state=active]:bg-[hsl(var(--gg-copper))] data-[state=active]:text-[hsl(var(--gg-surface-light))]'
      : 'data-[state=active]:bg-[hsl(var(--gg-green))] data-[state=active]:text-[hsl(var(--gg-surface-light))]';
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Category)} className="mb-4">
      <TabsList className="bg-[hsl(var(--gg-bg-light))] border border-[hsl(var(--gg-navy-deep))]/12 p-1 h-auto rounded-sm">
        <TabsTrigger
          value="hcp_low"
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] px-4 py-1.5 rounded-none ${activeBg}`}
        >
          Hándicap Inferior
        </TabsTrigger>
        <TabsTrigger
          value="hcp_high"
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] px-4 py-1.5 rounded-none ${activeBg}`}
        >
          Hándicap Superior
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function RoundHeader({
  label,
  name,
  date,
  count,
  accent,
  isMajor,
}: {
  label: string;
  name: string;
  date: string | null;
  count: number;
  accent: 'green' | 'copper';
  isMajor?: boolean;
}) {
  const accentColor = accent === 'copper' ? 'hsl(var(--gg-copper))' : 'hsl(var(--gg-green))';
  return (
    <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-left">
      <span
        className="text-[10px] font-bold uppercase tracking-[0.22em] px-2 py-[3px] border"
        style={{ color: accentColor, borderColor: accentColor + '55' }}
      >
        {label}
      </span>
      <span className="font-display text-base md:text-lg text-[hsl(var(--gg-navy-deep))]">
        {name}
      </span>
      <span className="text-xs text-[hsl(var(--gg-navy-deep))]/55 tabular-nums">
        {fmtDate(date)}
      </span>
      <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gg-navy-deep))]/55">
        {count} {count === 1 ? 'jugador' : 'jugadores'}
        {isMajor && <span className="ml-2" style={{ color: accentColor }}>· Major</span>}
      </span>
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-[hsl(var(--gg-gold))]/30 bg-[hsl(var(--gg-ivory))]/5 px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function CircuitoRoundsBreakdown({ data }: { data: PublicCircuitData }) {
  const rawItems = useMemo(() => buildCircuitoRoundBreakdown(data), [data]);
  const { data: metaMap } = useRoundsMetaMap();
  const items = useMemo(() => enrichRoundsMeta(rawItems, metaMap), [rawItems, metaMap]);
  const { played, pending } = useMemo(() => splitPlayedPending(items), [items]);
  const [catByRound, setCatByRound] = useState<Record<string, Category>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  if (items.length === 0) {
    return <EmptyMessage>Todavía no hay resultados publicados para esta competición.</EmptyMessage>;
  }

  const renderItem = ({ round, rowsByCat }: typeof items[number]) => {
    const total = rowsByCat.hcp_low.length + rowsByCat.hcp_high.length;
    const cat = catByRound[round.round_id] ?? 'hcp_low';
    const rows = rowsByCat[cat];
    return (
      <AccordionItem
        key={round.round_id}
        value={round.round_id}
        className="border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] rounded-sm shadow-[0_6px_24px_-18px_rgba(11,19,36,0.25)]"
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[hsl(var(--gg-bg-light))]">
          <RoundHeader
            label={round.label}
            name={round.name}
            date={round.date}
            count={total}
            accent="green"
          />
        </AccordionTrigger>
        <AccordionContent className="px-4">
          {total === 0 ? (
            <p className="py-4 text-sm text-center text-muted-foreground">
              Resultados pendientes de publicación.
            </p>
          ) : (
            <>
              <CatSwitcher
                value={cat}
                onChange={(c) =>
                  setCatByRound((prev) => ({ ...prev, [round.round_id]: c }))
                }
                accent="green"
              />
              {rows.length === 0 ? (
                <p className="py-4 text-sm text-center text-muted-foreground">
                  No hay jugadores en {getGalaxyGolfCategoryLabel(cat)} en esta prueba.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[hsl(var(--gg-navy-deep))]/10">
                  <Table className="[&_th]:px-2 [&_td]:px-2 [&_th]:py-2 [&_td]:py-1.5 sm:[&_th]:px-4 sm:[&_td]:px-4 sm:[&_th]:py-3 sm:[&_td]:py-3">
                    <TableHeader>
                      <TableRow className="bg-[hsl(var(--gg-bg-light))] hover:bg-[hsl(var(--gg-bg-light))]">
                        <TableHead className="w-8 sm:w-12 text-[9px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-green))]">Pos.</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-green))]">Jugador</TableHead>
                        <TableHead className="hidden sm:table-cell text-center text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--gg-green))]">HCP</TableHead>
                        <TableHead className="text-center text-[9px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-green))]">Stab.</TableHead>
                        <TableHead className="text-center text-[9px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-green))]">Estado</TableHead>
                        <TableHead className="hidden sm:table-cell text-center text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--gg-green))]">Bonus</TableHead>
                        <TableHead className="text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-copper))]">Contrib.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, i) => {
                        const hcp = fmtHcp(row.handicap);
                        return (
                        <TableRow key={row.player_id} className="border-b border-[hsl(var(--gg-navy-deep))]/8">
                          <TableCell className="font-semibold text-xs sm:text-sm text-[hsl(var(--gg-navy-deep))]/85 tabular-nums">{i + 1}</TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <button
                              type="button"
                              onClick={() => setSelectedPlayerId(row.player_id)}
                              className="text-left hover:underline decoration-[hsl(var(--gg-green))]/50 underline-offset-2 text-[hsl(var(--gg-navy-deep))] hover:text-[hsl(var(--gg-green))] transition-colors cursor-pointer"
                            >
                              {row.name}
                              {hcp && (
                                <span className="ml-1 text-[10px] font-normal tabular-nums text-[hsl(var(--gg-navy-deep))]/55 sm:hidden">
                                  ({hcp})
                                </span>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-center text-sm tabular-nums text-[hsl(var(--gg-navy-deep))]/75">{hcp ?? '—'}</TableCell>
                          <TableCell className="text-center text-xs sm:text-sm tabular-nums text-[hsl(var(--gg-navy-deep))]/85">{row.stableford}</TableCell>
                          <TableCell className="text-center"><StatusBadge status={row.status} /></TableCell>
                          <TableCell className="hidden sm:table-cell text-center text-sm tabular-nums text-[hsl(var(--gg-navy-deep))]/75">+{row.bonus}</TableCell>
                          <TableCell className="text-center font-sans font-bold text-[hsl(var(--gg-copper))] tabular-nums text-xs sm:text-sm">{row.contribution}</TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (<>
    {played.length > 0 && (
      <>
        <SectionDivider label="Resultados publicados" accent="green" />
        <Accordion type="multiple" className="space-y-3">
          {played.map(renderItem)}
        </Accordion>
      </>
    )}
    {pending.length > 0 && (
      <>
        <SectionDivider label="Próximas pruebas" accent="green" />
        <Accordion type="multiple" className="space-y-3">
          {pending.map(renderItem)}
        </Accordion>
      </>
    )}
    <PlayerProfileDialog
      playerId={selectedPlayerId}
      open={!!selectedPlayerId}
      onOpenChange={(o) => !o && setSelectedPlayerId(null)}
    />
  </>);
}

export function GalaxyCupRoundsBreakdown({ data }: { data: PublicCircuitData }) {
  const rawItems = useMemo(() => buildGalaxyCupRoundBreakdown(data), [data]);
  const { data: metaMap } = useRoundsMetaMap();
  const items = useMemo(() => enrichRoundsMeta(rawItems, metaMap), [rawItems, metaMap]);
  const { played, pending } = useMemo(() => splitPlayedPending(items), [items]);
  const [catByRound, setCatByRound] = useState<Record<string, Category>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  if (items.length === 0) {
    return <EmptyMessage>Todavía no hay resultados publicados para esta competición.</EmptyMessage>;
  }

  const renderItem = ({ round, rowsByCat }: typeof items[number]) => {
    const total = rowsByCat.hcp_low.length + rowsByCat.hcp_high.length;
    const cat = catByRound[round.round_id] ?? 'hcp_low';
    const rows = rowsByCat[cat];
    return (
      <AccordionItem
        key={round.round_id}
        value={round.round_id}
        className="border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] rounded-sm shadow-[0_6px_24px_-18px_rgba(11,19,36,0.25)]"
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[hsl(var(--gg-bg-light))]">
          <RoundHeader
            label={round.label}
            name={round.name}
            date={round.date}
            count={total}
            accent="copper"
            isMajor={round.isMajor}
          />
        </AccordionTrigger>
        <AccordionContent className="px-4">
          {total === 0 ? (
            <p className="py-4 text-sm text-center text-muted-foreground">
              Resultados pendientes de publicación.
            </p>
          ) : (
            <>
              <CatSwitcher
                value={cat}
                onChange={(c) =>
                  setCatByRound((prev) => ({ ...prev, [round.round_id]: c }))
                }
                accent="copper"
              />
              {rows.length === 0 ? (
                <p className="py-4 text-sm text-center text-muted-foreground">
                  No hay jugadores en {getGalaxyGolfCategoryLabel(cat)} en esta prueba.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[hsl(var(--gg-navy-deep))]/10">
                <div className="overflow-x-auto border border-[hsl(var(--gg-navy-deep))]/10">
                  <Table className="[&_th]:px-2 [&_td]:px-2 [&_th]:py-2 [&_td]:py-1.5 sm:[&_th]:px-4 sm:[&_td]:px-4 sm:[&_th]:py-3 sm:[&_td]:py-3">
                    <TableHeader>
                      <TableRow className="bg-[hsl(var(--gg-bg-light))] hover:bg-[hsl(var(--gg-bg-light))]">
                        <TableHead className="w-8 sm:w-12 text-[9px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-copper))]">Pos.</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-copper))]">Jugador</TableHead>
                        <TableHead className="hidden sm:table-cell text-center text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--gg-copper))]">HCP</TableHead>
                        <TableHead className="text-center text-[9px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-copper))]">Stab.</TableHead>
                        <TableHead className="text-center text-[9px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-copper))]">Estado</TableHead>
                        <TableHead className="text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.08em] sm:tracking-[0.16em] text-[hsl(var(--gg-copper))]">Puntos</TableHead>
                        <TableHead className="hidden sm:table-cell text-center text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--gg-copper))]">Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const hcp = fmtHcp(row.handicap);
                        return (
                        <TableRow key={row.player_id} className="border-b border-[hsl(var(--gg-navy-deep))]/8">
                          <TableCell className="font-semibold text-xs sm:text-sm text-[hsl(var(--gg-navy-deep))]/85 tabular-nums">
                            {row.position ?? <span className="text-[hsl(var(--gg-navy-deep))]/25">—</span>}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <button
                              type="button"
                              onClick={() => setSelectedPlayerId(row.player_id)}
                              className="text-left hover:underline decoration-[hsl(var(--gg-copper))]/50 underline-offset-2 text-[hsl(var(--gg-navy-deep))] hover:text-[hsl(var(--gg-copper))] transition-colors cursor-pointer"
                            >
                              {row.name}
                              {hcp && (
                                <span className="ml-1 text-[10px] font-normal tabular-nums text-[hsl(var(--gg-navy-deep))]/55 sm:hidden">
                                  ({hcp})
                                </span>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-center text-sm tabular-nums text-[hsl(var(--gg-navy-deep))]/75">{hcp ?? '—'}</TableCell>
                          <TableCell className="text-center text-xs sm:text-sm tabular-nums text-[hsl(var(--gg-navy-deep))]/85">
                            {row.status === 'completed' ? row.stableford : <span className="text-[hsl(var(--gg-navy-deep))]/25">—</span>}
                          </TableCell>
                          <TableCell className="text-center"><StatusBadge status={row.status} /></TableCell>
                          <TableCell className="text-center font-sans font-bold text-[hsl(var(--gg-copper))] tabular-nums text-xs sm:text-sm">
                            {row.status === 'completed' ? row.points : 0}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-center text-[10px] uppercase tracking-[0.16em]">
                            {row.isMajor ? (
                              <span className="text-[hsl(var(--gg-copper))]">Major</span>
                            ) : (
                              <span className="text-[hsl(var(--gg-navy-deep))]/55">Regular</span>
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (<>
    {played.length > 0 && (
      <>
        <SectionDivider label="Resultados publicados" accent="copper" />
        <Accordion type="multiple" className="space-y-3">
          {played.map(renderItem)}
        </Accordion>
      </>
    )}
    {pending.length > 0 && (
      <>
        <SectionDivider label="Próximas pruebas" accent="copper" />
        <Accordion type="multiple" className="space-y-3">
          {pending.map(renderItem)}
        </Accordion>
      </>
    )}
    <PlayerProfileDialog
      playerId={selectedPlayerId}
      open={!!selectedPlayerId}
      onOpenChange={(o) => !o && setSelectedPlayerId(null)}
    />
  </>);
}
