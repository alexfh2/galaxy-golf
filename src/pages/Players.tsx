import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, Trophy } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import heroPlayers from '@/assets/hero-players.png.asset.json';
import {
  fetchPublicCircuitData,
  publicCircuitDataQueryKey,
  type PublicResult,
} from '@/lib/publicCircuitData';
import {
  buildPlayerLastHandicapMap,
  getGalaxyGolfCategoryByHandicap,
  getGalaxyGolfCategoryLabel,
} from '@/lib/playerCategoryHandicap';
import { computeCircuito, computeGalaxyCup } from '@/pages/Rankings';

type Category = 'hcp_low' | 'hcp_high';
type CategoryFilter = 'all' | Category;
type CompetitionFilter = 'all' | 'circuito' | 'galaxycup';
type SortMode = 'default' | 'name' | 'circuito' | 'galaxycup' | 'hcp' | 'rounds';

interface PlayerRow {
  player_id: string;
  name: string;
  lastHcp: number | null;
  category: Category | null;
  circuitoPos: number | null;
  circuitoTotal: number | null;
  galaxyCupPos: number | null;
  galaxyCupPoints: number | null;
  roundsPlayed: number;
  lastRoundLabel: string | null;
  lastRoundSort: string;
}

interface LeaderInfo {
  name: string;
  pos: number;
  value: number;
  unit: string;
}

const fmtHcp = (h: number | null): string =>
  h == null || !Number.isFinite(h) ? '—' : h.toFixed(1).replace('.', ',');

const initials = (name: string): string =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const sortKey = (r: PublicResult): string => {
  const d = r.rounds?.date || r.play_date || '';
  const n = String(r.rounds?.round_number ?? 9999).padStart(4, '0');
  return `${d || '9999-99-99'}|${n}|${r.created_at || ''}`;
};

const venueName = (r: PublicResult): string =>
  r.rounds?.club?.trim() ||
  r.rounds?.course?.trim() ||
  r.rounds?.name?.trim() ||
  '—';

export default function Players() {
  const { data, isLoading } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
  });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [compFilter, setCompFilter] = useState<CompetitionFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const { rows, leaders, metrics } = useMemo(() => {
    if (!data) {
      return {
        rows: [] as PlayerRow[],
        leaders: {
          circuitoLow: null as LeaderInfo | null,
          circuitoHigh: null as LeaderInfo | null,
          galaxyLow: null as LeaderInfo | null,
          galaxyHigh: null as LeaderInfo | null,
        },
        metrics: { players: 0, jornadas: 0, competiciones: 0 },
      };
    }

    const lastHcpMap = buildPlayerLastHandicapMap(data.results);
    const circuito = computeCircuito(data.results, data.round_competitions);
    const galaxyCup = computeGalaxyCup(data.results, data.round_competitions);

    const circuitoPos = new Map<string, number>();
    const circuitoTotal = new Map<string, number>();
    const circuitoCat = new Map<string, Category>();
    (['hcp_low', 'hcp_high'] as Category[]).forEach((cat) => {
      circuito
        .filter((r) => r.category === cat)
        .forEach((r, idx) => {
          circuitoPos.set(r.player_id, idx + 1);
          circuitoTotal.set(r.player_id, r.total);
          circuitoCat.set(r.player_id, cat);
        });
    });

    const galaxyCupPos = new Map<string, number>();
    const galaxyCupPoints = new Map<string, number>();
    const galaxyCupCat = new Map<string, Category>();
    (['hcp_low', 'hcp_high'] as Category[]).forEach((cat) => {
      galaxyCup
        .filter((r) => r.category === cat)
        .forEach((r, idx) => {
          galaxyCupPos.set(r.player_id, idx + 1);
          galaxyCupPoints.set(r.player_id, r.points);
          galaxyCupCat.set(r.player_id, cat);
        });
    });

    const byPlayer = new Map<string, PublicResult[]>();
    for (const r of data.results) {
      const arr = byPlayer.get(r.player_id) ?? [];
      arr.push(r);
      byPlayer.set(r.player_id, arr);
    }

    const playerName = new Map(data.players.map((p) => [p.id, p.name]));

    const makeLeader = (cat: Category, list: typeof circuito, unit: string): LeaderInfo | null => {
      const arr = list.filter((r) => r.category === cat);
      if (arr.length === 0) return null;
      const top = arr[0];
      const value = 'total' in top ? (top as { total: number }).total : (top as { points: number }).points;
      return {
        name: playerName.get(top.player_id) || '—',
        pos: 1,
        value,
        unit,
      };
    };

    const leaders = {
      circuitoLow: makeLeader('hcp_low', circuito, 'pts'),
      circuitoHigh: makeLeader('hcp_high', circuito, 'pts'),
      galaxyLow: makeLeader('hcp_low', galaxyCup as unknown as typeof circuito, 'pts'),
      galaxyHigh: makeLeader('hcp_high', galaxyCup as unknown as typeof circuito, 'pts'),
    };

    const out: PlayerRow[] = [];
    for (const player of data.players) {
      const list = byPlayer.get(player.id) ?? [];
      if (list.length === 0) continue;
      const lastHcp = lastHcpMap.get(player.id) ?? null;
      const cat: Category | null =
        circuitoCat.get(player.id) ??
        galaxyCupCat.get(player.id) ??
        getGalaxyGolfCategoryByHandicap(lastHcp);
      const sorted = [...list].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
      const lastResult = sorted[0];

      out.push({
        player_id: player.id,
        name: player.name,
        lastHcp,
        category: cat,
        circuitoPos: circuitoPos.get(player.id) ?? null,
        circuitoTotal: circuitoTotal.get(player.id) ?? null,
        galaxyCupPos: galaxyCupPos.get(player.id) ?? null,
        galaxyCupPoints: galaxyCupPoints.get(player.id) ?? null,
        roundsPlayed: list.length,
        lastRoundLabel: lastResult ? venueName(lastResult) : null,
        lastRoundSort: lastResult ? sortKey(lastResult) : '',
      });
    }

    const jornadas = new Set(data.round_competitions.map((rc) => rc.round_id)).size
      || new Set(data.results.map((r) => r.round_id)).size;
    const competiciones = new Set(
      data.round_competitions.map((rc) => rc.competition?.id).filter(Boolean) as string[],
    ).size;

    return {
      rows: out,
      leaders,
      metrics: { players: out.length, jornadas, competiciones },
    };
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (compFilter === 'circuito' && r.circuitoPos == null) return false;
      if (compFilter === 'galaxycup' && r.galaxyCupPos == null) return false;
      return true;
    });
  }, [rows, search, categoryFilter, compFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const byPos = (a: number | null, b: number | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return a - b;
    };
    switch (sortMode) {
      case 'name':
        arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        break;
      case 'circuito':
        arr.sort((a, b) => byPos(a.circuitoPos, b.circuitoPos));
        break;
      case 'galaxycup':
        arr.sort((a, b) => byPos(a.galaxyCupPos, b.galaxyCupPos));
        break;
      case 'hcp':
        arr.sort((a, b) => {
          if (a.lastHcp == null && b.lastHcp == null) return 0;
          if (a.lastHcp == null) return 1;
          if (b.lastHcp == null) return -1;
          return a.lastHcp - b.lastHcp;
        });
        break;
      case 'rounds':
        arr.sort((a, b) => b.roundsPlayed - a.roundsPlayed);
        break;
      default:
        arr.sort((a, b) => {
          const ca = byPos(a.circuitoPos, b.circuitoPos);
          if (ca !== 0) return ca;
          const ga = byPos(a.galaxyCupPos, b.galaxyCupPos);
          if (ga !== 0) return ga;
          return a.name.localeCompare(b.name, 'es');
        });
    }
    return arr;
  }, [filtered, sortMode]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))] border-b border-[hsl(var(--gg-gold))]/20">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-bottom opacity-90"
          style={{ backgroundImage: `url(${heroPlayers.url})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, hsl(var(--gg-bg-light)) 0%, hsl(var(--gg-bg-light) / 0.94) 40%, hsl(var(--gg-bg-light) / 0.6) 70%, hsl(var(--gg-bg-light) / 0.2) 100%)',
          }}
        />
        <div className="container relative mx-auto px-4 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div>
              <p className="mb-5 text-[10px] font-semibold tracking-[0.32em] text-[hsl(var(--gg-green))]">
                TEMPORADA 2026
              </p>
              <h1
                className="font-display font-light leading-[1.02] text-[hsl(var(--gg-navy-deep))]"
                style={{ fontSize: 'clamp(2.5rem, 5vw, 4.75rem)' }}
              >
                Jugadores
              </h1>
              <p className="mt-6 max-w-xl text-base md:text-lg text-[hsl(var(--gg-navy-deep))]/75 font-light leading-relaxed">
                Consulta el ranking vivo, el perfil y la trayectoria de los jugadores
                del circuito.
              </p>
            </div>

            {/* Metrics card */}
            <div className="bg-[hsl(var(--gg-surface-light))]/95 backdrop-blur border border-[hsl(var(--gg-navy-deep))]/12 shadow-[0_18px_60px_-30px_rgba(11,19,36,0.35)] p-6 md:p-7">
              <div className="text-[10px] font-semibold tracking-[0.28em] text-[hsl(var(--gg-green))] mb-5">
                CIRCUITO EN VIVO
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Metric label="Jugadores" value={metrics.players} />
                <Metric label="Jornadas" value={metrics.jornadas} />
                <Metric label="Competiciones" value={metrics.competiciones} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background pb-20 pt-10">
        <div className="container mx-auto px-4">
          {/* LÍDERES */}
          {(leaders.circuitoLow || leaders.circuitoHigh || leaders.galaxyLow || leaders.galaxyHigh) && (
            <div className="mb-10 border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] p-5 md:p-6 shadow-[0_8px_30px_-20px_rgba(11,19,36,0.25)]">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 text-[hsl(var(--gg-copper))]" />
                <h2 className="text-[11px] font-semibold tracking-[0.28em] text-[hsl(var(--gg-navy-deep))]/80 uppercase">
                  Líderes actuales
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <LeaderCell title="Circuito · Hcp Inferior" tone="green" leader={leaders.circuitoLow} />
                <LeaderCell title="Circuito · Hcp Superior" tone="green" leader={leaders.circuitoHigh} />
                <LeaderCell title="GalaxyCup · Hcp Inferior" tone="copper" leader={leaders.galaxyLow} />
                <LeaderCell title="GalaxyCup · Hcp Superior" tone="copper" leader={leaders.galaxyHigh} />
              </div>
            </div>
          )}

          {/* FILTROS */}
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--gg-navy-deep))]/40" />
              <Input
                placeholder="Buscar jugador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[hsl(var(--gg-surface-light))] border-[hsl(var(--gg-navy-deep))]/15"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
              <SelectTrigger className="w-full md:w-[200px] bg-[hsl(var(--gg-surface-light))] border-[hsl(var(--gg-navy-deep))]/15">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="hcp_low">Hándicap Inferior</SelectItem>
                <SelectItem value="hcp_high">Hándicap Superior</SelectItem>
              </SelectContent>
            </Select>
            <Select value={compFilter} onValueChange={(v) => setCompFilter(v as CompetitionFilter)}>
              <SelectTrigger className="w-full md:w-[210px] bg-[hsl(var(--gg-surface-light))] border-[hsl(var(--gg-navy-deep))]/15">
                <SelectValue placeholder="Competición" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las competiciones</SelectItem>
                <SelectItem value="circuito">Con ranking Circuito</SelectItem>
                <SelectItem value="galaxycup">Con ranking GalaxyCup</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="w-full md:w-[200px] bg-[hsl(var(--gg-surface-light))] border-[hsl(var(--gg-navy-deep))]/15">
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Orden por defecto</SelectItem>
                <SelectItem value="name">Por nombre</SelectItem>
                <SelectItem value="circuito">Por ranking Circuito</SelectItem>
                <SelectItem value="galaxycup">Por ranking GalaxyCup</SelectItem>
                <SelectItem value="hcp">Por último hándicap</SelectItem>
                <SelectItem value="rounds">Por torneos jugados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* LISTADO */}
          {isLoading ? (
            <EmptyMessage>Cargando jugadores...</EmptyMessage>
          ) : rows.length === 0 ? (
            <EmptyMessage>
              Los jugadores aparecerán cuando se publiquen los primeros resultados oficiales.
            </EmptyMessage>
          ) : sorted.length === 0 ? (
            <EmptyMessage>No se han encontrado jugadores con esos filtros.</EmptyMessage>
          ) : (
            <RosterList players={sorted} onSelect={setSelectedPlayerId} />
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl md:text-4xl text-[hsl(var(--gg-navy-deep))] tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/55">
        {label}
      </div>
    </div>
  );
}

function LeaderCell({
  title,
  tone,
  leader,
}: {
  title: string;
  tone: 'green' | 'copper';
  leader: LeaderInfo | null;
}) {
  const toneClass =
    tone === 'green'
      ? 'border-l-[hsl(var(--gg-green))]/70 text-[hsl(var(--gg-green))]'
      : 'border-l-[hsl(var(--gg-copper))]/70 text-[hsl(var(--gg-copper))]';
  return (
    <div className={`border-l-2 ${toneClass} pl-3`}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/55">
        {title}
      </div>
      {leader ? (
        <>
          <div className="mt-1 font-display text-lg text-[hsl(var(--gg-navy-deep))] truncate">
            {leader.name}
          </div>
          <div className={`mt-0.5 text-[11px] font-medium tabular-nums ${tone === 'green' ? 'text-[hsl(var(--gg-green))]' : 'text-[hsl(var(--gg-copper))]'}`}>
            #{leader.pos} · {leader.value} {leader.unit}
          </div>
        </>
      ) : (
        <div className="mt-1 font-display text-lg text-[hsl(var(--gg-navy-deep))]/40 italic">
          Pendiente
        </div>
      )}
    </div>
  );
}

function RosterList({
  players,
  onSelect,
}: {
  players: PlayerRow[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] shadow-[0_8px_40px_-28px_rgba(11,19,36,0.3)]">
      {/* Desktop header */}
      <div className="hidden lg:grid grid-cols-[2fr_70px_1.1fr_1.4fr_1.4fr_80px_1.4fr_40px] gap-3 px-5 py-3 border-b border-[hsl(var(--gg-navy-deep))]/15 bg-[hsl(var(--gg-green))]/8 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--gg-navy-deep))]/70 font-semibold">
        <div>Jugador</div>
        <div className="text-center">HCP</div>
        <div>Categoría</div>
        <div>Circuito</div>
        <div>GalaxyCup</div>
        <div className="text-center">Torneos</div>
        <div>Última jornada</div>
        <div />
      </div>

      <ul className="divide-y divide-[hsl(var(--gg-navy-deep))]/8">
        {players.map((p) => (
          <PlayerRowItem key={p.player_id} player={p} onSelect={() => onSelect(p.player_id)} />
        ))}
      </ul>
    </div>
  );
}

function PlayerRowItem({ player, onSelect }: { player: PlayerRow; onSelect: () => void }) {
  const catLabel = player.category ? getGalaxyGolfCategoryLabel(player.category) : '—';

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="group w-full text-left px-4 lg:px-5 py-4 transition-colors hover:bg-[hsl(var(--gg-gold))]/8 focus:outline-none focus:bg-[hsl(var(--gg-gold))]/10"
      >
        {/* DESKTOP ROW */}
        <div className="hidden lg:grid grid-cols-[2fr_70px_1.1fr_1.4fr_1.4fr_80px_1.4fr_40px] gap-3 items-center">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--gg-green))]/12 text-[hsl(var(--gg-green))] font-display text-sm">
              {initials(player.name)}
            </div>
            <div className="font-display text-base text-[hsl(var(--gg-navy-deep))] truncate group-hover:text-[hsl(var(--gg-green))] transition-colors">
              {player.name}
            </div>
          </div>
          <div className="text-center text-sm tabular-nums text-[hsl(var(--gg-navy-deep))]/85">
            {fmtHcp(player.lastHcp)}
          </div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--gg-navy-deep))]/65">
            {catLabel}
          </div>
          <div>
            {player.circuitoPos != null ? (
              <span className="inline-flex items-center gap-1 border border-[hsl(var(--gg-green))]/40 text-[hsl(var(--gg-green))] text-[10px] uppercase tracking-[0.16em] font-semibold px-2 py-[3px]">
                #{player.circuitoPos}
                {player.circuitoTotal != null && (
                  <span className="font-sans tabular-nums normal-case tracking-normal text-[11px]">
                    · {player.circuitoTotal} pts
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[hsl(var(--gg-navy-deep))]/35 text-xs">—</span>
            )}
          </div>
          <div>
            {player.galaxyCupPos != null ? (
              <span className="inline-flex items-center gap-1 border border-[hsl(var(--gg-copper))]/45 text-[hsl(var(--gg-copper))] text-[10px] uppercase tracking-[0.16em] font-semibold px-2 py-[3px]">
                #{player.galaxyCupPos}
                {player.galaxyCupPoints != null && (
                  <span className="font-sans tabular-nums normal-case tracking-normal text-[11px]">
                    · {player.galaxyCupPoints} pts
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[hsl(var(--gg-navy-deep))]/35 text-xs">—</span>
            )}
          </div>
          <div className="text-center text-sm tabular-nums text-[hsl(var(--gg-navy-deep))]/85">
            {player.roundsPlayed}
          </div>
          <div className="text-[12px] text-[hsl(var(--gg-navy-deep))]/70 truncate">
            {player.lastRoundLabel || '—'}
          </div>
          <div className="flex justify-end">
            <ChevronRight className="h-4 w-4 text-[hsl(var(--gg-navy-deep))]/40 group-hover:text-[hsl(var(--gg-green))] transition-colors" />
          </div>
        </div>

        {/* MOBILE CARD */}
        <div className="lg:hidden">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--gg-green))]/12 text-[hsl(var(--gg-green))] font-display text-base">
              {initials(player.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="font-display text-base text-[hsl(var(--gg-navy-deep))] leading-tight truncate group-hover:text-[hsl(var(--gg-green))]">
                  {player.name}
                </div>
                <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-[hsl(var(--gg-navy-deep))]/40" />
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--gg-navy-deep))]/55">
                {player.roundsPlayed} {player.roundsPlayed === 1 ? 'torneo' : 'torneos'} · Hcp {fmtHcp(player.lastHcp)} · {catLabel}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {player.circuitoPos != null && (
                  <span className="inline-flex items-center gap-1 border border-[hsl(var(--gg-green))]/40 text-[hsl(var(--gg-green))] text-[10px] uppercase tracking-[0.16em] font-semibold px-2 py-[3px]">
                    #{player.circuitoPos} Circuito
                    {player.circuitoTotal != null && (
                      <span className="font-sans tabular-nums normal-case tracking-normal text-[11px]">
                        · {player.circuitoTotal} pts
                      </span>
                    )}
                  </span>
                )}
                {player.galaxyCupPos != null && (
                  <span className="inline-flex items-center gap-1 border border-[hsl(var(--gg-copper))]/45 text-[hsl(var(--gg-copper))] text-[10px] uppercase tracking-[0.16em] font-semibold px-2 py-[3px]">
                    #{player.galaxyCupPos} GalaxyCup
                    {player.galaxyCupPoints != null && (
                      <span className="font-sans tabular-nums normal-case tracking-normal text-[11px]">
                        · {player.galaxyCupPoints} pts
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--gg-navy-deep))]/10 pt-2 text-[11px] text-[hsl(var(--gg-navy-deep))]/65">
                <span className="uppercase font-semibold tracking-wider">
                  TORNEOS JUGADOS: {player.roundsPlayed}
                </span>
                {player.lastRoundLabel && (
                  <span className="truncate ml-3">Última: {player.lastRoundLabel}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] px-6 py-10 text-center text-sm text-[hsl(var(--gg-navy-deep))]/65">
      {children}
    </div>
  );
}
