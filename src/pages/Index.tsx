import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import circuitoLogo from '@/assets/circuito-galaxygolf.png.asset.json';
import galaxycupLogo from '@/assets/galaxycup-v2.png.asset.json';

type RoundCompetitionLink = {
  competitions: { name: string; slug: string; display_order: number | null } | null;
};

const Index = () => {
  const { data: lastRound } = useQuery({
    queryKey: ['home-last-published-round'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rounds')
        .select('*, round_competitions(competitions(name, slug, display_order))')
        .eq('status', 'published')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const lastRoundName =
    lastRound?.name || lastRound?.course || lastRound?.club || 'Sede por confirmar';
  const lastRoundComps: RoundCompetitionLink[] = ((lastRound?.round_competitions ?? []) as RoundCompetitionLink[])
    .filter((l) => l.competitions)
    .sort((a, b) => (a.competitions?.display_order ?? 0) - (b.competitions?.display_order ?? 0));

  const formatDate = (d?: string | null) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <div className="animate-fade-in bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))]">
      {/* ——— ACCESOS A COMPETICIONES (HERO) ——— */}
      <section className="container pt-10 pb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1 bg-[hsl(var(--gg-green))]/25" />
          <h2 className="text-[11px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-green))]">
            Temporada 2026
          </h2>
          <div className="h-px flex-1 bg-[hsl(var(--gg-green))]/25" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Circuito GalaxyGolf */}
          <article className="relative overflow-hidden border border-[hsl(var(--gg-green))]/30 bg-[hsl(var(--gg-green))]/8 p-8 flex flex-col items-center text-center group hover:border-[hsl(var(--gg-green))]/55 transition-colors shadow-[0_4px_28px_-14px_rgba(11,19,36,0.22)]">
            <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-[hsl(var(--gg-green))]/55" />
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-green))] mb-5">
              Circuito
            </p>
            <CompetitionWordmark variant="circuito" />
            <p className="text-[11px] text-[hsl(var(--gg-navy-deep))]/70 leading-relaxed mt-5 mb-6 max-w-[26ch]">
              Ranking anual por categorías, pruebas regulares y Gran Final.
            </p>
            <div className="mt-auto">
              <Link
                to="/circuito-galaxygolf"
                className="inline-flex items-center gap-3 px-6 py-3 bg-[hsl(var(--gg-green))] text-white text-[11px] font-semibold uppercase tracking-[0.22em] hover:bg-[hsl(var(--gg-green))]/85 transition-colors"
              >
                Ver Circuito
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* GalaxyCup */}
          <article className="relative overflow-hidden border border-[hsl(var(--gg-copper))]/30 bg-[hsl(var(--gg-copper))]/6 p-8 flex flex-col items-center text-center group hover:border-[hsl(var(--gg-copper))]/55 transition-colors shadow-[0_4px_28px_-14px_rgba(11,19,36,0.22)]">
            <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-[hsl(var(--gg-copper))]/55" />
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-copper))] mb-5">
              Race to the Playoffs
            </p>
            <CompetitionWordmark variant="galaxycup" />
            <p className="text-[11px] text-[hsl(var(--gg-navy-deep))]/70 leading-relaxed mt-5 mb-6 max-w-[26ch]">
              Competición por puntos con Majors y Playoffs.
            </p>
            <div className="mt-auto">
              <Link
                to="/galaxycup"
                className="inline-flex items-center gap-3 px-6 py-3 bg-[hsl(var(--gg-copper))] text-white text-[11px] font-semibold uppercase tracking-[0.22em] hover:bg-[hsl(var(--gg-copper))]/85 transition-colors"
              >
                Ver GalaxyCup
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* ——— ÚLTIMA PRUEBA JUGADA ——— */}
      <section className="container pb-8">
        {lastRound ? (() => {
          const slugs = lastRoundComps.map((l) => l.competitions!.slug);
          const isCup = slugs.includes('galaxycup');
          const isCircuito = slugs.includes('circuito-galaxygolf') || slugs.includes('circuito');
          const ctaBg = isCup && !isCircuito ? 'gg-copper' : 'gg-green';
          return (
            <article className="border border-[hsl(var(--gg-border-light))] bg-[hsl(var(--gg-surface-light))] px-5 py-4 lg:px-6 lg:py-4 flex flex-col lg:flex-row lg:items-center gap-4 shadow-[0_4px_20px_-14px_rgba(11,19,36,0.18)]">
              <div className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5">
                <span className="text-[10px] font-semibold tracking-[0.28em] uppercase text-[hsl(var(--gg-gold))] shrink-0">
                  Última prueba
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {lastRoundComps.map((l) => (
                    <span
                      key={l.competitions!.slug}
                      className={`text-[9px] font-semibold tracking-[0.22em] uppercase px-2 py-0.5 border ${
                        l.competitions!.slug === 'galaxycup'
                          ? 'text-[hsl(var(--gg-copper))] border-[hsl(var(--gg-copper))]/45'
                          : 'text-[hsl(var(--gg-green))] border-[hsl(var(--gg-green))]/45'
                      }`}
                    >
                      {l.competitions!.name}
                    </span>
                  ))}
                </div>
                <h3 className="font-display text-lg lg:text-xl text-[hsl(var(--gg-navy-deep))] leading-tight truncate">
                  {lastRoundName}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[hsl(var(--gg-navy-deep))]/65">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {formatDate(lastRound.date)}
                  </span>
                  {lastRound.course && lastRound.name && lastRound.course !== lastRound.name && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {lastRound.course}
                    </span>
                  )}
                </div>
              </div>
              <Link
                to={`/jornades?round=${lastRound.id}`}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white text-[10px] font-semibold uppercase tracking-[0.22em] transition-colors shrink-0 ${
                  ctaBg === 'gg-copper'
                    ? 'bg-[hsl(var(--gg-copper))] hover:bg-[hsl(var(--gg-copper))]/85'
                    : 'bg-[hsl(var(--gg-green))] hover:bg-[hsl(var(--gg-green))]/85'
                }`}
              >
                Ver resultados
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          );
        })() : (
          <div className="border border-dashed border-[hsl(var(--gg-border-light))] bg-[hsl(var(--gg-bg-light))] p-6 text-center">
            <p className="text-[12px] text-[hsl(var(--gg-navy-deep))]/65 italic">
              Los resultados aparecerán cuando se publique la primera prueba.
            </p>
          </div>
        )}
      </section>

      {/* ——— SPONSORS STRIP ——— */}
      <section className="border-y border-[hsl(var(--gg-green))]/20 bg-[hsl(var(--gg-bg-light))]">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-green))] shrink-0">
              Patrocinadores oficiales
            </p>
            <div className="flex-1 grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-3 items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 flex items-center justify-center text-[10px] font-semibold tracking-[0.22em] uppercase text-[hsl(var(--gg-navy-deep))]/40"
                >
                  Sponsor
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ——— SEASON STATS ——— */}
      <section className="bg-[hsl(var(--gg-bg-light))]">
        <div className="container py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <StaticStat value="2" label="Competiciones" />
          <StaticStat value="29" label="Jornadas" />
          <StaticStat value="2026" label="Temporada" />
        </div>
      </section>
    </div>
  );
};

/**
 * CompetitionWordmark — PNG oficial de cada competición.
 */
function CompetitionWordmark({ variant }: { variant: 'circuito' | 'galaxycup' }) {
  const isCircuito = variant === 'circuito';
  const src = isCircuito ? circuitoLogo.url : galaxycupLogo.url;
  const alt = isCircuito ? 'Circuito GalaxyGolf' : 'GalaxyCup';
  return (
    <div className="select-none flex justify-center w-full">
      <img
        src={src}
        alt={alt}
        className={`w-auto object-contain max-h-[56px] sm:max-h-[68px] lg:max-h-[84px] ${
          isCircuito ? 'max-w-[280px]' : 'max-w-[240px]'
        }`}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

function StaticStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-display text-5xl text-[hsl(var(--gg-navy-deep))]">{value}</span>
      <span className="text-[11px] font-semibold tracking-[0.25em] uppercase text-[hsl(var(--gg-green))]">
        {label}
      </span>
    </div>
  );
}

export default Index;
