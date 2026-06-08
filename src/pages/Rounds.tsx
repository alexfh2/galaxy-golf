import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, MapPin, Users, ChevronDown, BarChart3, CalendarPlus, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';
import { buildPlayerCategoryHandicapMap } from '@/lib/playerCategoryHandicap';
import { computeScratchStableford } from '@/lib/scratchStableford';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import heroCalendar from '@/assets/hero-calendar.png.asset.json';

type CompetitionSlug = 'circuito-galaxygolf' | 'galaxycup';
type Stage = 'regular' | 'major' | 'playoff' | 'final';
type CompetitionFilter = 'all' | CompetitionSlug;

type RoundCompetitionLink = {
  stage: Stage;
  competition_round_number: number | null;
  competitions: {
    name: string;
    slug: CompetitionSlug;
    display_order: number;
  } | null;
};

const Rounds = () => {
  const locale = es;
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState('hcpLow');
  const [filter, setFilter] = useState<CompetitionFilter>('all');
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const downloadBtnRef = useRef<HTMLButtonElement | null>(null);

  const toggleDownloadMenu = () => {
    if (!downloadMenuOpen && downloadBtnRef.current) {
      const r = downloadBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setDownloadMenuOpen((v) => !v);
  };

  const { data: rounds, isLoading } = useQuery({
    queryKey: ['public-rounds-all-with-competitions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rounds')
        .select('*, round_competitions(stage, competition_round_number, competitions(name, slug, display_order))')
        .order('date', { ascending: true });
      return data || [];
    },
  });

  const today = new Date().toISOString().split('T')[0];

  const getLinks = (round: any): RoundCompetitionLink[] => {
    const raw = (round?.round_competitions ?? []) as RoundCompetitionLink[];
    return [...raw]
      .filter((l) => l.competitions)
      .sort(
        (a, b) =>
          (a.competitions?.display_order ?? 0) - (b.competitions?.display_order ?? 0),
      );
  };

  const visibleRounds = useMemo(() => {
    if (!rounds) return [];
    if (filter === 'all') return rounds;
    return rounds.filter((r: any) =>
      getLinks(r).some((l) => l.competitions?.slug === filter),
    );
  }, [rounds, filter]);

  const filterOptions: { value: CompetitionFilter; label: string }[] = [
    { value: 'all', label: 'Todas las pruebas' },
    { value: 'circuito-galaxygolf', label: 'Circuito GALAXY GOLF' },
    { value: 'galaxycup', label: 'GalaxyCup' },
  ];

  const stageLabel = (stage: Stage): string | null => {
    if (stage === 'major') return 'Major';
    if (stage === 'playoff') return 'Playoff';
    if (stage === 'final') return 'Final';
    return null;
  };

  const isHighlightStage = (stage: Stage) =>
    stage === 'major' || stage === 'playoff' || stage === 'final';

  const badgeClass = (slug: CompetitionSlug | undefined, highlight: boolean) => {
    if (highlight) {
      return 'text-[10px] px-2 py-0.5 border border-[hsl(var(--gg-copper))]/60 bg-[hsl(var(--gg-copper))]/10 text-[hsl(var(--gg-copper))] font-semibold tracking-[0.15em] uppercase';
    }
    if (slug === 'galaxycup') {
      return 'text-[10px] px-2 py-0.5 border border-[hsl(var(--gg-gold))]/40 text-[hsl(var(--gg-gold))] font-medium tracking-[0.14em] uppercase';
    }
    return 'text-[10px] px-2 py-0.5 border border-[hsl(var(--gg-gold))]/35 text-[hsl(var(--gg-gold))]/90 font-medium tracking-[0.14em] uppercase';
  };

  const renderRoundBadges = (round: any) => {
    const links = getLinks(round);
    if (!links.length) return null;

    if (filter === 'all') {
      return links.map((l, idx) => {
        const slug = l.competitions?.slug;
        const isCircuito = slug === 'circuito-galaxygolf';
        const shortName = isCircuito ? 'Circuito' : 'GalaxyCup';
        const stage = stageLabel(l.stage);
        const parts = [shortName];
        if (stage) parts.push(stage);
        if (l.competition_round_number != null && l.stage !== 'final') {
          parts.push(`P${l.competition_round_number}`);
        }
        return (
          <span key={idx} className={badgeClass(slug, isHighlightStage(l.stage))}>
            {parts.join(' · ')}
          </span>
        );
      });
    }

    const link = links.find((l) => l.competitions?.slug === filter);
    if (!link) return null;
    const compName = link.competitions?.name ?? '';
    const stage = stageLabel(link.stage);

    const badges: JSX.Element[] = [];
    let mainLabel = '';
    if (link.stage === 'final') {
      mainLabel = `${compName} · Final`;
    } else {
      mainLabel = `${compName} · P${link.competition_round_number ?? '?'}`;
    }
    badges.push(
      <span key="main" className={badgeClass(link.competitions?.slug, link.stage === 'final')}>
        {mainLabel}
      </span>,
    );
    if (filter === 'galaxycup' && stage && (link.stage === 'major' || link.stage === 'playoff')) {
      badges.push(
        <span key="stage" className={badgeClass(link.competitions?.slug, true)}>
          {stage}
        </span>,
      );
    }
    return badges;
  };

  const buildIcsEvent = (round: any) => {
    const startDate = round.date.replace(/-/g, '');
    const endRaw = round.end_date || round.date;
    const endNext = new Date(endRaw);
    endNext.setDate(endNext.getDate() + 1);
    const endDate = endNext.toISOString().split('T')[0].replace(/-/g, '');
    const title = `${round.name} — GALAXY GOLF`;
    const location = [round.club, round.course].filter(Boolean).join(' — ');
    const description = [round.sponsor ? `Patrocinador: ${round.sponsor}` : ''].filter(Boolean).join('\\n');
    return [
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:${title}`,
      location ? `LOCATION:${location}` : '',
      description ? `DESCRIPTION:${description}` : '',
      `UID:${round.id}@galaxygolf`,
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  };

  const buildIcsContent = (round: any) => {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GalaxyGolf//ES',
      buildIcsEvent(round),
      'END:VCALENDAR',
    ].join('\r\n');
  };

  const downloadIcs = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCalendarIcs = (scope: 'all' | CompetitionSlug) => {
    if (!rounds?.length) return;
    const source = scope === 'all'
      ? rounds
      : rounds.filter((r: any) => getLinks(r).some((l) => l.competitions?.slug === scope));
    if (!source.length) return;
    const seen = new Set<string>();
    const events = source
      .filter((r: any) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .map((r: any) => buildIcsEvent(r))
      .join('\r\n');
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GalaxyGolf//ES\r\n${events}\r\nEND:VCALENDAR`;
    const filename =
      scope === 'circuito-galaxygolf'
        ? 'circuito-galaxygolf-2026.ics'
        : scope === 'galaxycup'
          ? 'galaxycup-2026.ics'
          : 'galaxygolf-2026.ics';
    downloadIcs(ics, filename);
    setDownloadMenuOpen(false);
  };

  const { data: roundData } = useQuery({
    queryKey: [...publicCircuitDataQueryKey, 'round-results', expandedRound],
    queryFn: async () => {
      if (!expandedRound) return { results: [], categoryHcpMap: new Map<string, number | null>() };
      const data = await fetchPublicCircuitData();
      const categoryHcpMap = buildPlayerCategoryHandicapMap(data.results as any);
      const results = data.results
        .filter((result) => result.round_id === expandedRound)
        .sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
      return { results, categoryHcpMap };
    },
    enabled: !!expandedRound,
  });

  const roundResults = roundData?.results;
  const categoryHcpMap = roundData?.categoryHcpMap ?? new Map<string, number | null>();

  const categorizeResults = (results: typeof roundResults) => {
    if (!results) return {};
    const hcpLow = results.filter(r => {
      const hcp = categoryHcpMap.get(r.player_id) ?? r.handicap_at_round ?? ((r as any).players_public)?.current_handicap;
      return hcp != null && hcp <= 15.4;
    }).sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const hcpHigh = results.filter(r => {
      const hcp = categoryHcpMap.get(r.player_id) ?? r.handicap_at_round ?? ((r as any).players_public)?.current_handicap;
      return hcp != null && hcp >= 15.5;
    }).sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const female = results.filter(r => ((r as any).players_public)?.gender === 'F')
      .sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const senior = results.filter(r => ((r as any).players_public)?.is_senior)
      .sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const scratch = results
      .map(r => ({ ...r, _scratchPts: computeScratchStableford(r.scorecard, (r as any).rounds?.course_par) }))
      .filter(r => r._scratchPts != null)
      .sort((a, b) => (b._scratchPts ?? 0) - (a._scratchPts ?? 0));
    return { hcpLow, hcpHigh, female, senior, scratch };
  };

  const categorized = categorizeResults(roundResults);

  const roundCategories = [
    { key: 'hcpLow', label: 'Hándicap Inferior (≤15,4)' },
    { key: 'hcpHigh', label: 'Hándicap Superior (≥15,5)' },
    { key: 'scratch', label: 'Scratch' },
  ];

  const renderResultsTable = (results: any[], scoreField: 'stableford' | 'scratch' = 'stableford') => {
    if (!results?.length) return <p className="text-muted-foreground text-sm py-4 text-center">Sin datos</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-[10px] text-muted-foreground/70 font-medium tracking-[0.15em] uppercase">
              <th className="text-left py-3 pr-2 w-12 border-b border-border/30">Pos.</th>
              <th className="text-left py-3 border-b border-border/30">Nombre <span className="font-normal text-muted-foreground/50">(hcp)</span></th>
              <th className="text-right py-3 border-b border-border/30">{scoreField === 'scratch' ? 'Scratch' : 'Stableford'}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r: any, i: number) => {
              const position = i + 1;
              const isTop3 = position <= 3;
              const accentAlpha = position === 1 ? 0.18 : position === 2 ? 0.11 : position === 3 ? 0.06 : 0;
              const value = scoreField === 'scratch'
                ? (r._scratchPts ?? computeScratchStableford(r.scorecard, r.rounds?.course_par))
                : r.stableford_points;
              return (
                <tr
                  key={r.id}
                  className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors"
                  style={
                    isTop3
                      ? {
                          background: `linear-gradient(90deg, hsl(var(--accent) / ${accentAlpha}) 0%, hsl(var(--accent) / ${accentAlpha * 0.4}) 30%, transparent 70%)`,
                        }
                      : undefined
                  }
                >
                  <td className={`py-3.5 pr-2 text-sm font-semibold ${isTop3 ? 'text-accent' : 'text-muted-foreground'}`}>{position}</td>
                  <td className="py-3.5">
                    <button type="button" onClick={() => setSelectedPlayerId(r.player_id)} className="flex items-center gap-2 hover:text-accent transition-colors text-left">
                      <div className="h-6 w-6 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                        <Users className="h-3 w-3 text-muted-foreground/60" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{((r as any).players_public)?.name}</span>
                      {r.handicap_at_round != null && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono">({Number(r.handicap_at_round).toFixed(1)})</span>
                      )}
                    </button>
                  </td>
                  <td className={`py-3.5 text-right font-mono font-bold text-sm ${isTop3 ? 'text-accent' : 'text-foreground'}`}>{value ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Summary by active filter
  const summary = (() => {
    if (filter === 'circuito-galaxygolf') {
      return {
        title: 'Circuito GALAXY GOLF',
        count: visibleRounds.length,
        support: '12 pruebas + Gran Final',
      };
    }
    if (filter === 'galaxycup') {
      return {
        title: 'GalaxyCup',
        count: visibleRounds.length,
        support: 'Fase regular, Majors y Playoffs',
      };
    }
    return {
      title: 'Temporada completa',
      count: visibleRounds.length,
      support: null as string | null,
    };
  })();

  return (
    <div className="animate-fade-in">
      {/* ——— EDITORIAL HEADER ——— */}
      <section className="relative overflow-hidden bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))] border-b border-[hsl(var(--gg-gold))]/20">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroCalendar.url})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, hsl(var(--gg-bg-light)) 0%, hsl(var(--gg-bg-light) / 0.92) 35%, hsl(var(--gg-bg-light) / 0.55) 60%, hsl(var(--gg-bg-light) / 0.15) 100%)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gg-gold))]/40 to-transparent"
        />

        <div className="container relative py-14 lg:py-20">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              <p className="mb-4 text-[10px] font-semibold tracking-[0.32em] text-[hsl(var(--gg-green))]">
                TEMPORADA 2026
              </p>
              <h1
                className="font-display font-light leading-[1.05] text-[hsl(var(--gg-navy-deep))] mb-5"
                style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}
              >
                Calendario
              </h1>
              <p className="text-base md:text-lg text-[hsl(var(--gg-navy-deep))]/80 font-light max-w-xl">
                Consulta todas las pruebas del Circuito GalaxyGolf y la GalaxyCup, incluyendo Majors, Playoffs y Gran Final.
              </p>
            </div>
            <div className="relative self-start lg:self-end">
              <button
                onClick={() => setDownloadMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={downloadMenuOpen}
                className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-semibold tracking-[0.22em] uppercase border border-[hsl(var(--gg-green))]/60 text-[hsl(var(--gg-green))] hover:bg-[hsl(var(--gg-green))]/10 transition-colors bg-[hsl(var(--gg-surface-light))]/70 backdrop-blur-sm"
              >
                <CalendarPlus className="h-4 w-4" />
                Descargar calendario
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${downloadMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {downloadMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDownloadMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 z-50 bg-[hsl(var(--gg-surface-light))] border border-[hsl(var(--gg-border-light))] shadow-lg overflow-hidden"
                  >
                    <button
                      role="menuitem"
                      onClick={() => downloadCalendarIcs('all')}
                      className="w-full text-left px-5 py-3 text-[12px] tracking-[0.08em] text-[hsl(var(--gg-navy-deep))] hover:bg-[hsl(var(--gg-green))]/10 transition-colors border-b border-[hsl(var(--gg-border-light))]"
                    >
                      Todo el calendario
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => downloadCalendarIcs('circuito-galaxygolf')}
                      className="w-full text-left px-5 py-3 text-[12px] tracking-[0.08em] text-[hsl(var(--gg-navy-deep))] hover:bg-[hsl(var(--gg-green))]/10 transition-colors border-b border-[hsl(var(--gg-border-light))]"
                    >
                      Circuito GalaxyGolf
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => downloadCalendarIcs('galaxycup')}
                      className="w-full text-left px-5 py-3 text-[12px] tracking-[0.08em] text-[hsl(var(--gg-navy-deep))] hover:bg-[hsl(var(--gg-copper))]/10 transition-colors"
                    >
                      GalaxyCup
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ——— FILTERS + SUMMARY ——— */}
      <section className="container pt-10 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Segmented control */}
          <div className="-mx-4 px-4 lg:mx-0 lg:px-0 overflow-x-auto">
            <div className="inline-flex p-1 bg-[hsl(var(--gg-surface-light))] border border-[hsl(var(--gg-border-light))] whitespace-nowrap">
              {filterOptions.map((opt) => {
                const active = filter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all ${
                      active
                        ? 'bg-[hsl(var(--gg-green))] text-[#FFFDF8]'
                        : 'text-[hsl(var(--gg-text-muted))] hover:text-[hsl(var(--gg-green))]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 border border-[hsl(var(--gg-border-light))] bg-[hsl(var(--gg-surface-light))] px-5 py-3">
            {filter === 'galaxycup' && (
              <Trophy className="h-5 w-5 text-[hsl(var(--gg-copper))]" strokeWidth={1.4} />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[hsl(var(--gg-green))]">
                {summary.title}
              </span>
              <span className="font-display text-xl text-[hsl(var(--gg-navy-deep))]">
                {summary.count} pruebas
              </span>
              {summary.support && (
                <span className="text-[10px] text-[hsl(var(--gg-text-muted))] tracking-wide">
                  {summary.support}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ——— ROUNDS LIST ——— */}
      <section className="container pb-16">
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Cargando…</p>
        ) : !visibleRounds?.length ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Sin datos</p>
        ) : (
          <div className="space-y-3">
            {visibleRounds.map((round: any) => {
              const played = round.date < today || (round.end_date && round.end_date < today);
              const isOngoing = !played && round.date <= today && (!round.end_date || round.end_date >= today);
              const hasResults = round.status === 'published';
              const isExpanded = expandedRound === round.id;
              const links = getLinks(round);
              const isGalaxyCup = links.some((l) => l.competitions?.slug === 'galaxycup');
              const isCircuito = links.some((l) => l.competitions?.slug === 'circuito-galaxygolf');

              // Surface treatment: played/published = denser, upcoming = lighter
              const cardSurface = hasResults
                ? 'bg-[hsl(var(--gg-surface-light))] border-[hsl(var(--gg-border-light))] shadow-sm'
                : isOngoing
                ? 'bg-[hsl(var(--gg-surface-light))] border-[hsl(var(--gg-copper))]/40'
                : 'bg-[hsl(var(--gg-bg-light))] border-[hsl(var(--gg-border-light))]/70 border-dashed';

              const accentColor = isCircuito
                ? 'bg-[hsl(var(--gg-green))]'
                : isGalaxyCup
                ? 'bg-[hsl(var(--gg-copper))]'
                : 'bg-[hsl(var(--gg-border-light))]';

              const accentWidth = hasResults ? 'w-[4px]' : isOngoing ? 'w-[3px]' : 'w-[2px]';

              return (
                <div
                  key={round.id}
                  className={`relative border transition-all ${cardSurface}`}
                >
                  {/* left accent bar */}
                  <span
                    aria-hidden
                    className={`absolute left-0 top-0 bottom-0 ${accentWidth} ${accentColor} ${
                      !hasResults && !isOngoing ? 'opacity-50' : ''
                    }`}
                  />

                  <button
                    onClick={() => (hasResults ? setExpandedRound(isExpanded ? null : round.id) : null)}
                    className={`w-full text-left pl-5 pr-4 py-3.5 ${
                      hasResults ? 'cursor-pointer hover:bg-[hsl(var(--gg-green))]/[0.04]' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* LEFT: chips + title + meta + status */}
                      <div className="flex-1 min-w-0">
                        {/* chips row */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {renderRoundBadges(round)}
                        </div>

                        {/* title + meta inline for density */}
                        <div className="flex items-baseline gap-3 flex-wrap">
                          <h3
                            className={`font-display font-medium leading-tight text-lg lg:text-xl ${
                              hasResults || isOngoing
                                ? 'text-[hsl(var(--gg-navy-deep))]'
                                : 'text-[hsl(var(--gg-navy-deep))]/75'
                            }`}
                          >
                            {round.name}
                          </h3>
                          {round.sponsor && (
                            <span className="text-[11px] font-sans text-[hsl(var(--gg-text-muted))]">
                              · {round.sponsor}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-4 text-[11px] text-[hsl(var(--gg-text-muted))]">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-[hsl(var(--gg-green))]/70" strokeWidth={1.6} />
                            <span className="font-medium text-[hsl(var(--gg-navy-deep))]/75">
                              {format(new Date(round.date), 'dd MMM yyyy', { locale })}
                              {round.end_date && round.end_date !== round.date && (
                                <> — {format(new Date(round.end_date), 'dd MMM yyyy', { locale })}</>
                              )}
                            </span>
                          </span>
                          {round.course && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-[hsl(var(--gg-gold))]/80" strokeWidth={1.6} />
                              {round.course}
                            </span>
                          )}
                          {/* status pill */}
                          {hasResults ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] uppercase bg-[hsl(var(--gg-green))]/10 text-[hsl(var(--gg-green))] border border-[hsl(var(--gg-green))]/25">
                              Resultados publicados
                            </span>
                          ) : isOngoing ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] uppercase bg-[hsl(var(--gg-copper))]/10 text-[hsl(var(--gg-copper))] border border-[hsl(var(--gg-copper))]/30">
                              En curso
                            </span>
                          ) : played ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] uppercase text-[hsl(var(--gg-text-muted))] border border-[hsl(var(--gg-border-light))]">
                              Pendiente de publicación
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] uppercase text-[hsl(var(--gg-green))]/85 border border-[hsl(var(--gg-green))]/30">
                              Próxima prueba
                            </span>
                          )}
                        </div>
                      </div>

                      {/* RIGHT: CTA */}
                      <div className="flex items-center gap-2 shrink-0">
                        {hasResults ? (
                          <span className="inline-flex items-center gap-2 px-3.5 py-2 text-[10px] font-semibold tracking-[0.2em] uppercase bg-[hsl(var(--gg-green))] text-[#FFFDF8] hover:bg-[hsl(var(--gg-green))]/90 transition-colors">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Ver resultados
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </span>
                        ) : isOngoing ? (
                          <span className="inline-flex items-center gap-2 px-3.5 py-2 text-[10px] font-semibold tracking-[0.2em] uppercase border border-[hsl(var(--gg-copper))]/60 text-[hsl(var(--gg-copper))]">
                            <Trophy className="h-3.5 w-3.5" />
                            Ver jornada
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadIcs(buildIcsContent(round), `${round.name.replace(/\s+/g, '-').toLowerCase()}.ics`);
                            }}
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-[10px] font-semibold tracking-[0.2em] uppercase border border-[hsl(var(--gg-green))]/55 text-[hsl(var(--gg-green))] hover:bg-[hsl(var(--gg-green))]/8 transition-colors"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            Añadir al calendario
                          </button>
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[hsl(var(--gg-border-light))] px-5 py-4 bg-[hsl(var(--gg-bg-light))]/40">
                      <div className="flex items-center gap-2 mb-3 text-[11px] text-[hsl(var(--gg-text-muted))] tracking-wide">
                        <Users className="h-3.5 w-3.5" />
                        <span>{roundResults?.length || 0} participantes</span>
                      </div>

                      {roundResults && roundResults.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {roundCategories.map((cat) => (
                              <button
                                key={cat.key}
                                onClick={() => setActiveResultTab(cat.key)}
                                className={`px-4 py-2 text-[11px] font-semibold tracking-[0.15em] uppercase transition-all border ${
                                  activeResultTab === cat.key
                                    ? 'border-[hsl(var(--gg-green))]/60 bg-[hsl(var(--gg-green))] text-[#FFFDF8]'
                                    : 'border-[hsl(var(--gg-border-light))] text-[hsl(var(--gg-text-muted))] hover:text-[hsl(var(--gg-green))] hover:border-[hsl(var(--gg-green))]/40'
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                          {renderResultsTable((categorized as any)[activeResultTab], activeResultTab === 'scratch' ? 'scratch' : 'stableford')}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Cargando…</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <PlayerProfileDialog playerId={selectedPlayerId} open={!!selectedPlayerId} onOpenChange={(o) => !o && setSelectedPlayerId(null)} />
    </div>
  );
};

export default Rounds;
