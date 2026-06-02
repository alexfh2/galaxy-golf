import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';

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

  const rows = useMemo<PlayerRow[]>(() => {
    if (!data) return [];

    const lastHcpMap = buildPlayerLastHandicapMap(data.results);
    const circuito = computeCircuito(data.results, data.round_competitions);
    const galaxyCup = computeGalaxyCup(data.results, data.round_competitions);

    // Posiciones por categoría dentro de cada competición.
    const circuitoPos = new Map<string, number>();
    const circuitoTotal = new Map<string, number>();
    (['hcp_low', 'hcp_high'] as Category[]).forEach((cat) => {
      circuito
        .filter((r) => r.category === cat)
        .forEach((r, idx) => {
          circuitoPos.set(r.player_id, idx + 1);
          circuitoTotal.set(r.player_id, r.total);
        });
    });

    const galaxyCupPos = new Map<string, number>();
    const galaxyCupPoints = new Map<string, number>();
    (['hcp_low', 'hcp_high'] as Category[]).forEach((cat) => {
      galaxyCup
        .filter((r) => r.category === cat)
        .forEach((r, idx) => {
          galaxyCupPos.set(r.player_id, idx + 1);
          galaxyCupPoints.set(r.player_id, r.points);
        });
    });

    // Resultados por jugador (todos los publicados visibles).
    const byPlayer = new Map<string, PublicResult[]>();
    for (const r of data.results) {
      const arr = byPlayer.get(r.player_id) ?? [];
      arr.push(r);
      byPlayer.set(r.player_id, arr);
    }

    const out: PlayerRow[] = [];
    for (const player of data.players) {
      const list = byPlayer.get(player.id) ?? [];
      if (list.length === 0) continue; // solo jugadores con resultados publicados
      const lastHcp = lastHcpMap.get(player.id) ?? null;
      const cat = getGalaxyGolfCategoryByHandicap(lastHcp);
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
    return out;
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
        // Defecto: circuito > galaxycup > nombre
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
      <section className="relative overflow-hidden bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))] border-b border-[hsl(var(--gg-gold))]/20">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroPlayers.url})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, hsl(var(--gg-bg-light)) 0%, hsl(var(--gg-bg-light) / 0.92) 35%, hsl(var(--gg-bg-light) / 0.55) 60%, hsl(var(--gg-bg-light) / 0.15) 100%)',
          }}
        />
        <div className="container relative mx-auto px-4 py-12 md:py-16">
          <p className="mb-5 text-[10px] font-semibold tracking-[0.32em] text-[hsl(var(--gg-green))]">
            TEMPORADA 2026
          </p>
          <h1
            className="font-display font-light leading-[1.05] text-[hsl(var(--gg-navy-deep))]"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}
          >
            Jugadores
          </h1>
          <p className="mt-6 max-w-2xl text-base md:text-lg text-[hsl(var(--gg-navy-deep))]/80 font-light">
            Perfiles de jugadores con resultados publicados en Circuito GalaxyGolf y
            GalaxyCup.
          </p>
        </div>
      </section>

      <section className="bg-background pb-16 pt-10">
        <div className="container mx-auto px-4">
          {/* Filtros */}
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
                <SelectItem value="rounds">Por pruebas jugadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Listado */}
          {isLoading ? (
            <EmptyMessage>Cargando jugadores...</EmptyMessage>
          ) : rows.length === 0 ? (
            <EmptyMessage>
              Los jugadores aparecerán cuando se publiquen los primeros resultados oficiales.
            </EmptyMessage>
          ) : sorted.length === 0 ? (
            <EmptyMessage>No se han encontrado jugadores con esos filtros.</EmptyMessage>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((p) => (
                <PlayerCard
                  key={p.player_id}
                  player={p}
                  onSelect={() => setSelectedPlayerId(p.player_id)}
                />
              ))}
            </div>
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

function PlayerCard({ player, onSelect }: { player: PlayerRow; onSelect: () => void }) {
  const catLabel = player.category ? getGalaxyGolfCategoryLabel(player.category) : '—';
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group text-left border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] p-5 shadow-[0_6px_24px_-16px_rgba(11,19,36,0.2)] transition-colors hover:border-[hsl(var(--gg-green))]/45 focus:outline-none focus:border-[hsl(var(--gg-green))]/60"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--gg-green))]/10 text-[hsl(var(--gg-green))] font-display text-lg">
          {initials(player.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight text-[hsl(var(--gg-navy-deep))] truncate group-hover:text-[hsl(var(--gg-green))] transition-colors">
            {player.name}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/55">
            Hcp {fmtHcp(player.lastHcp)} · {catLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {player.circuitoPos != null && (
          <span className="inline-flex items-center gap-1 border border-[hsl(var(--gg-green))]/45 text-[hsl(var(--gg-green))] text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-[3px]">
            #{player.circuitoPos} Circuito
            {player.circuitoTotal != null && (
              <span className="font-sans tabular-nums normal-case tracking-normal text-[11px]">
                · {player.circuitoTotal} pts
              </span>
            )}
          </span>
        )}
        {player.galaxyCupPos != null && (
          <span className="inline-flex items-center gap-1 border border-[hsl(var(--gg-copper))]/50 text-[hsl(var(--gg-copper))] text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-[3px]">
            #{player.galaxyCupPos} GalaxyCup
            {player.galaxyCupPoints != null && (
              <span className="font-sans tabular-nums normal-case tracking-normal text-[11px]">
                · {player.galaxyCupPoints} pts
              </span>
            )}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[hsl(var(--gg-navy-deep))]/10 pt-3 text-[11px] text-[hsl(var(--gg-navy-deep))]/65">
        <span>
          {player.roundsPlayed} {player.roundsPlayed === 1 ? 'prueba' : 'pruebas'}
        </span>
        {player.lastRoundLabel && (
          <span className="truncate ml-3">Última: {player.lastRoundLabel}</span>
        )}
      </div>
    </button>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl rounded-sm border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] px-6 py-10 text-center text-sm text-[hsl(var(--gg-navy-deep))]/65">
      {children}
    </div>
  );
}
