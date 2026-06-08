import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { ca, es } from 'date-fns/locale';
import ScorecardVisual from '@/components/ScorecardVisual';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';
import { buildPlayerCategoryHandicapMap } from '@/lib/playerCategoryHandicap';

interface PlayerProfileDialogProps {
  playerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initials = (name: string) =>
  name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();

const PlayerProfileDialog = ({ playerId, open, onOpenChange }: PlayerProfileDialogProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ca' ? ca : es;
  const [openCards, setOpenCards] = useState<string[]>([]);
  const [scratchMode, setScratchMode] = useState<Record<string, boolean>>({});

  const { data: player } = useQuery({
    queryKey: [...publicCircuitDataQueryKey, 'dialog-player', playerId],
    queryFn: fetchPublicCircuitData,
    select: (data) => data.players.find((player) => player.id === playerId) ?? null,
    enabled: !!playerId && open,
  });

  const { data: results } = useQuery({
    queryKey: ['player-profile-dialog-results', playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('results')
        .select('*, rounds!inner(id, name, date, club, round_number, status, course_par, course_handicap, course_handicap_women)')
        .eq('player_id', playerId!)
        .eq('rounds.status', 'published')
        .order('rounds(round_number)');
      return data || [];
    },
    enabled: !!playerId && open,
  });

  const { data: allResults } = useQuery({
    queryKey: [...publicCircuitDataQueryKey, 'dialog-results'],
    queryFn: fetchPublicCircuitData,
    select: (data) => data.results.filter((result) => result.stableford_points != null),
    enabled: open,
  });

  const { data: roundComps } = useQuery({
    queryKey: [...publicCircuitDataQueryKey, 'dialog-round-comps'],
    queryFn: fetchPublicCircuitData,
    select: (data) => data.round_competitions,
    enabled: open,
  });

  // GalaxyCup point tables (mirror Rankings page)
  const GALAXYCUP_REGULAR_POINTS = [500,300,190,135,110,100,90,85,80,75,70,65,60,57,56,55,54,53,52,51];
  const GALAXYCUP_MAJOR_POINTS = [750,450,285,200,165,150,135,125,120,115,110,105,100,90,85,80,75,70,65,60];

  const positions = useMemo(() => {
    if (!allResults?.length || !playerId || !roundComps) return null;

    const categoryHcpMap = buildPlayerCategoryHandicapMap(allResults as any);
    const playerHcp = categoryHcpMap.get(playerId) ?? null;
    const playerCat: 'hcp_low' | 'hcp_high' | null =
      playerHcp == null ? null : playerHcp <= 15.4 ? 'hcp_low' : 'hcp_high';

    if (!playerCat) {
      return { categoryHcp: playerHcp, categoryLabel: null, circuito: null, galaxyCup: null };
    }

    const playerCategoryMap = new Map<string, 'hcp_low' | 'hcp_high'>();
    for (const [pid, h] of categoryHcpMap.entries()) {
      if (h == null) continue;
      playerCategoryMap.set(pid, h <= 15.4 ? 'hcp_low' : 'hcp_high');
    }

    const circuitoRoundIds = new Set(
      (roundComps || [])
        .filter((rc: any) => rc.competition?.slug === 'circuito-galaxygolf' && rc.stage === 'regular' && rc.counts_for_ranking)
        .map((rc: any) => rc.round_id),
    );
    const cByPlayer = new Map<string, { stbs: number[]; bonus: number }>();
    for (const r of allResults as any[]) {
      if (!circuitoRoundIds.has(r.round_id)) continue;
      if (r.stableford_points == null) continue;
      if (playerCategoryMap.get(r.player_id) !== playerCat) continue;
      const e = cByPlayer.get(r.player_id) ?? { stbs: [], bonus: 0 };
      e.stbs.push(Number(r.stableford_points));
      e.bonus += 1 + Number(r.extra_play_count ?? 0);
      cByPlayer.set(r.player_id, e);
    }
    const circuitoRanking = Array.from(cByPlayer.entries())
      .map(([id, e]) => {
        const best7 = [...e.stbs].sort((a, b) => b - a).slice(0, 7).reduce((s, n) => s + n, 0);
        return { id, total: best7 + e.bonus };
      })
      .sort((a, b) => b.total - a.total);

    const cupStage = new Map<string, 'regular' | 'major'>();
    for (const rc of (roundComps || []) as any[]) {
      if (rc.competition?.slug === 'galaxycup' && rc.counts_for_ranking && (rc.stage === 'regular' || rc.stage === 'major')) {
        cupStage.set(rc.round_id, rc.stage);
      }
    }
    const cupAwards = new Map<string, number>();
    const byRound = new Map<string, any[]>();
    for (const r of allResults as any[]) {
      if (!cupStage.has(r.round_id)) continue;
      if (r.stableford_points == null) continue;
      if (!playerCategoryMap.has(r.player_id)) continue;
      const arr = byRound.get(r.round_id) ?? [];
      arr.push(r);
      byRound.set(r.round_id, arr);
    }
    for (const [rid, list] of byRound.entries()) {
      const stage = cupStage.get(rid)!;
      const table = stage === 'major' ? GALAXYCUP_MAJOR_POINTS : GALAXYCUP_REGULAR_POINTS;
      const inCat = list.filter((r) => playerCategoryMap.get(r.player_id) === playerCat);
      inCat.sort((a, b) => Number(b.stableford_points ?? 0) - Number(a.stableford_points ?? 0));
      inCat.forEach((r, i) => {
        const pts = i < 20 ? table[i] : 0;
        cupAwards.set(r.player_id, (cupAwards.get(r.player_id) ?? 0) + pts);
      });
    }
    const cupRanking = Array.from(cupAwards.entries())
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total);

    const findPos = (rk: { id: string; total: number }[]) => {
      const idx = rk.findIndex((r) => r.id === playerId);
      return idx === -1 ? null : { pos: idx + 1, total: rk[idx].total, of: rk.length };
    };

    return {
      categoryHcp: playerHcp,
      categoryLabel: playerCat === 'hcp_low' ? 'Hándicap Inferior' : 'Hándicap Superior',
      circuito: findPos(circuitoRanking),
      galaxyCup: findPos(cupRanking),
    };
  }, [allResults, playerId, roundComps]);


  const roundCompMap = useMemo(() => {
    const map = new Map<string, { name: string; competition_type: string }[]>();
    for (const rc of (roundComps || [])) {
      if (!map.has(rc.round_id)) map.set(rc.round_id, []);
      if (rc.competition) map.get(rc.round_id)!.push(rc.competition);
    }
    return map;
  }, [roundComps]);

  const getRoundCompetitionLabels = (roundId: string): Array<{ label: string; variant: 'cup' | 'circuit' }> => {
    const comps = roundCompMap.get(roundId) || [];
    const names = comps.map(c => c.name?.toLowerCase() ?? '');
    const out: Array<{ label: string; variant: 'cup' | 'circuit' }> = [];
    if (names.some(n => n.includes('cup'))) out.push({ label: 'GalaxyCup', variant: 'cup' });
    if (names.some(n => n.includes('circuito') || n.includes('galaxygolf'))) out.push({ label: 'Circuito', variant: 'circuit' });
    return out;
  };


  if (!player) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl bg-[hsl(var(--gg-bg-light))] border border-[hsl(var(--gg-navy-deep))]/14 text-[hsl(var(--gg-navy-deep))]">
          <p className="text-sm text-[hsl(var(--gg-navy-deep))]/60 py-8 text-center">{t('common.loading')}</p>
        </DialogContent>
      </Dialog>
    );
  }

  // Resumen básico (no derivado de scorecards hoyo-a-hoyo)
  const stbScores = (results || []).filter((r) => r.stableford_points != null).map((r) => r.stableford_points!);
  const roundsPlayed = (results || []).length;
  const avgStb = stbScores.length ? (stbScores.reduce((a, b) => a + b, 0) / stbScores.length).toFixed(1) : '—';
  const bestStb = stbScores.length ? Math.max(...stbScores) : '—';

  const lastHcp = (() => {
    const ordered = [...(results || [])]
      .filter((r) => r.handicap_at_round != null)
      .sort((a, b) => {
        const ra = (a.rounds as any)?.round_number ?? 0;
        const rb = (b.rounds as any)?.round_number ?? 0;
        return rb - ra;
      });
    return ordered[0]?.handicap_at_round ?? player.current_handicap ?? null;
  })();

  const summary = [
    { label: 'Torneos jugados', value: roundsPlayed },
    { label: 'Mejor Stableford', value: bestStb },
    { label: 'Media Stableford', value: avgStb },
    { label: 'Hándicap actual', value: lastHcp ?? '—' },
  ];

  const categoryLabel = positions?.categoryLabel ?? null;
  const rankingCells: { label: string; pos: { pos: number; total: number; of: number } | null }[] = [
    { label: 'Circuito GalaxyGolf', pos: positions?.circuito ?? null },
    { label: 'GalaxyCup', pos: positions?.galaxyCup ?? null },
  ];
  const hasAnyRanking = !!(positions?.circuito || positions?.galaxyCup);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0 bg-[hsl(var(--gg-bg-light))] border border-[hsl(var(--gg-navy-deep))]/14 text-[hsl(var(--gg-navy-deep))]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[hsl(var(--gg-navy-deep))]/10">
          <DialogTitle className="font-display font-light text-2xl leading-tight text-[hsl(var(--gg-navy-deep))]">
            Perfil del jugador
          </DialogTitle>
          {categoryLabel && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-[hsl(var(--gg-green))] font-semibold">
              {categoryLabel}
            </p>
          )}
        </DialogHeader>

        {/* Cabecera jugador */}
        <div className="px-6 pt-5 pb-4 flex items-center gap-4 border-b border-[hsl(var(--gg-navy-deep))]/8 bg-[hsl(var(--gg-surface-light))]">
          <Avatar className="h-16 w-16 border border-[hsl(var(--gg-gold))]/40">
            {player.photo_url && <AvatarImage src={player.photo_url} alt={player.name} />}
            <AvatarFallback className="bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))] font-semibold">
              {initials(player.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-light text-2xl leading-tight text-[hsl(var(--gg-navy-deep))] truncate">
              {player.name}
            </h3>
            <p className="text-xs text-[hsl(var(--gg-navy-deep))]/65 mt-1">
              {roundsPlayed} {roundsPlayed === 1 ? 'torneo' : 'torneos'}
              {lastHcp != null && <> · Hcp {lastHcp}</>}
              {player.club && <> · {player.club}</>}
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Resumen básico */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summary.map((s) => (
              <div
                key={s.label}
                className="border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] px-4 py-3 rounded-sm"
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--gg-green))] font-semibold">
                  {s.label}
                </div>
                <div className="mt-1.5 font-display text-2xl text-[hsl(var(--gg-navy-deep))] tabular-nums">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Posiciones por competición */}
          {hasAnyRanking && (
            <div>
              <h4 className="font-display text-lg text-[hsl(var(--gg-navy-deep))] mb-3">
                Posición en clasificaciones
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {rankingCells.map((cell, i) => {
                  const accent = i === 0 ? 'hsl(var(--gg-green))' : 'hsl(var(--gg-copper))';
                  return (
                    <div
                      key={cell.label}
                      className="border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] p-4 rounded-sm"
                    >
                      <div
                        className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2"
                        style={{ color: accent }}
                      >
                        {cell.label}
                      </div>
                      {cell.pos ? (
                        <div className="flex items-end justify-between gap-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-display text-3xl text-[hsl(var(--gg-navy-deep))] tabular-nums leading-none">
                              {cell.pos.pos}
                            </span>
                            <span className="text-xs text-[hsl(var(--gg-navy-deep))]/55">/ {cell.pos.of}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-base tabular-nums" style={{ color: accent }}>
                              {cell.pos.total}
                            </div>
                            <div className="text-[10px] text-[hsl(var(--gg-navy-deep))]/55 leading-none uppercase tracking-wider">
                              puntos
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-[hsl(var(--gg-navy-deep))]/45 italic h-[44px] flex items-center">
                          Sin clasificación
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evolución hándicap */}
          {(() => {
            const hcpData = (results || [])
              .filter(r => r.handicap_at_round != null)
              .map(r => ({
                label: `J${(r.rounds as any)?.round_number}`,
                hcp: Number(r.handicap_at_round),
              }));
            if (hcpData.length < 2) return null;

            const values = hcpData.map(d => d.hcp);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min || 1;
            const chartH = 60;
            const chartW = Math.max(200, hcpData.length * 60);
            const padX = 30;
            const padY = 22;
            const usableW = chartW - padX * 2;
            const usableH = chartH - padY * 2;

            const points = hcpData.map((d, i) => ({
              x: padX + (i / (hcpData.length - 1)) * usableW,
              y: padY + (1 - (d.hcp - min) / range) * usableH,
              hcp: d.hcp,
              label: d.label,
            }));

            const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

            return (
              <div>
                <h4 className="font-display text-lg text-[hsl(var(--gg-navy-deep))] mb-3">
                  Evolución de hándicap
                </h4>
                <div className="bg-[hsl(var(--gg-surface-light))] rounded-sm p-3 border border-[hsl(var(--gg-navy-deep))]/12 overflow-x-auto">
                  <svg width={chartW} height={chartH + 20}>
                    <polyline
                      points={polyline}
                      fill="none"
                      stroke="hsl(var(--gg-green))"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4" fill="hsl(var(--gg-copper))" />
                        <text x={p.x} y={p.y - 8} textAnchor="middle" className="fill-[hsl(var(--gg-navy-deep))] text-[10px] font-mono font-semibold">
                          {p.hcp}
                        </text>
                        <text x={p.x} y={chartH + 14} textAnchor="middle" className="fill-[hsl(var(--gg-navy-deep))]/55 text-[9px]">
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            );
          })()}

          {/* Historial de rondas */}
          <div>
            <h4 className="font-display text-lg text-[hsl(var(--gg-navy-deep))] mb-3">
              Historial de torneos
            </h4>
            {results && results.length > 0 ? (
              <Accordion type="multiple" value={openCards} onValueChange={setOpenCards} className="space-y-2">
                {results.map((r) => {
                  const round = r.rounds as any;
                  const raw = r.scorecard as any;
                  const scorecard: number[] | null = Array.isArray(raw) ? raw : raw?.scores ?? null;
                  const handicapPlay: number | null = raw?.handicap_play ?? null;
                  const coursePar: number[] | undefined = Array.isArray(round?.course_par) ? round.course_par : undefined;
                  const scratchStableford = scorecard && coursePar && scorecard.length === coursePar.length
                    ? scorecard.reduce((total, s, i) => {
                        if (s == null || s === 0) return total;
                        const diff = s - coursePar[i];
                        if (diff <= -3) return total + 5;
                        if (diff === -2) return total + 4;
                        if (diff === -1) return total + 3;
                        if (diff === 0) return total + 2;
                        if (diff === 1) return total + 1;
                        return total;
                      }, 0)
                    : null;

                  return (
                    <AccordionItem
                      key={r.id}
                      value={r.id}
                      className="border border-[hsl(var(--gg-navy-deep))]/12 rounded-sm overflow-hidden bg-[hsl(var(--gg-surface-light))]"
                    >
                      <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))]">
                        <div className="flex items-center gap-2 text-left flex-1 min-w-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono shrink-0 px-1.5 py-0 border-[hsl(var(--gg-green))]/40 text-[hsl(var(--gg-green))] bg-transparent"
                          >
                            J{round?.round_number}
                          </Badge>
                          <span className="font-medium text-sm truncate text-[hsl(var(--gg-navy-deep))]">{round?.name}</span>
                          {(() => {
                            const comps = getRoundCompetitionLabels(round?.id);
                            if (!comps.length) return null;
                            return comps.map(comp => (
                              <Badge
                                key={comp.variant}
                                variant="secondary"
                                className={`text-[9px] font-semibold shrink-0 px-1.5 py-0 border ${
                                  comp.variant === 'cup'
                                    ? 'bg-[hsl(var(--gg-copper))]/10 text-[hsl(var(--gg-copper))] border-[hsl(var(--gg-copper))]/30'
                                    : 'bg-[hsl(var(--gg-green))]/10 text-[hsl(var(--gg-green))] border-[hsl(var(--gg-green))]/30'
                                }`}
                              >
                                {comp.label}
                              </Badge>
                            ));
                          })()}
                          <span className="text-xs text-[hsl(var(--gg-navy-deep))]/55 ml-auto mr-2 shrink-0">
                            {round?.date ? format(new Date(round.date), 'dd MMM', { locale }) : ''}
                          </span>
                          <span className="font-mono font-bold text-sm text-[hsl(var(--gg-copper))] mr-1 shrink-0 tabular-nums">
                            {r.stableford_points ?? '—'}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 bg-[hsl(var(--gg-bg-light))]">
                        <div className="flex items-center gap-3 mb-3 mt-2 text-xs flex-wrap">
                          <div
                            className="inline-flex rounded-sm border border-[hsl(var(--gg-navy-deep))]/15 overflow-hidden"
                            role="group"
                            aria-label="Modo de puntuación"
                          >
                            <button
                              type="button"
                              onClick={() => setScratchMode((m) => ({ ...m, [r.id]: false }))}
                              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                                !scratchMode[r.id]
                                  ? 'bg-[hsl(var(--gg-green))] text-[hsl(var(--gg-surface-light))]'
                                  : 'bg-[hsl(var(--gg-surface-light))] text-[hsl(var(--gg-navy-deep))]/65 hover:text-[hsl(var(--gg-navy-deep))]'
                              }`}
                              aria-pressed={!scratchMode[r.id]}
                            >
                              Stb HCP <strong className="ml-1 font-mono">{r.stableford_points ?? '—'}</strong>
                            </button>
                            <button
                              type="button"
                              onClick={() => setScratchMode((m) => ({ ...m, [r.id]: true }))}
                              className={`px-3 py-1.5 text-xs font-medium transition-all border-l border-[hsl(var(--gg-navy-deep))]/15 ${
                                scratchMode[r.id]
                                  ? 'bg-[hsl(var(--gg-green))] text-[hsl(var(--gg-surface-light))]'
                                  : 'bg-[hsl(var(--gg-surface-light))] text-[hsl(var(--gg-navy-deep))]/65 hover:text-[hsl(var(--gg-navy-deep))]'
                              }`}
                              aria-pressed={!!scratchMode[r.id]}
                            >
                              Scratch <strong className="ml-1 font-mono">{scratchStableford ?? '—'}</strong>
                            </button>
                          </div>
                          <span className="text-[hsl(var(--gg-navy-deep))]/65 ml-auto">
                            HCP: <strong className="text-[hsl(var(--gg-navy-deep))]">{r.handicap_at_round ?? '—'}</strong>
                            {handicapPlay != null ? ` (HPU: ${handicapPlay})` : ''}
                          </span>
                        </div>
                        {scorecard && scorecard.length > 0 ? (
                          <div className="overflow-x-auto max-w-[calc(100vw-4rem)]">
                            <ScorecardVisual
                              scores={scorecard}
                              par={coursePar}
                              handicap={Array.isArray(round?.course_handicap) ? round.course_handicap : undefined}
                              handicapWomen={Array.isArray((round as any)?.course_handicap_women) ? (round as any).course_handicap_women : undefined}
                              playerGender={player.gender}
                              playerHandicap={scratchMode[r.id] ? 0 : (handicapPlay ?? r.handicap_at_round)}
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-[hsl(var(--gg-navy-deep))]/55">Sin tarjeta disponible.</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <p className="text-sm text-[hsl(var(--gg-navy-deep))]/55 text-center py-4">
                Sin torneos registrados.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerProfileDialog;
