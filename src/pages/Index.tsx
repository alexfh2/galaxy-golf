import { Link } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import circuitoLogo from '@/assets/circuito-galaxygolf-v2.png.asset.json';
import galaxycupLogo from '@/assets/galaxycup-v3.png.asset.json';
import { useRandomHero } from '@/lib/heroPool';
import { SponsorsStrip } from '@/components/SponsorsStrip';

type RoundCompetitionLink = {
  competitions: { name: string; slug: string; display_order: number | null } | null;
};

type RoundRow = {
  id: string;
  name: string | null;
  course: string | null;
  club: string | null;
  date: string | null;
  status: string | null;
  round_competitions: RoundCompetitionLink[] | null;
};

const Index = () => {
  const heroUrl = useRandomHero('home');
  const { data: lastRounds } = useQuery({
    queryKey: ['home-last-published-rounds'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rounds')
        .select('id, name, course, club, date, status, round_competitions(competitions(name, slug, display_order))')
        .eq('status', 'published')
        .order('date', { ascending: false })
        .limit(3);
      return (data ?? []) as unknown as RoundRow[];
    },
  });

  const rounds = lastRounds ?? [];

  const formatDate = (d?: string | null) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const roundLabel = (r: RoundRow) => r.name || r.course || r.club || 'Sede por confirmar';

  const roundComps = (r: RoundRow): RoundCompetitionLink[] =>
    (r.round_competitions ?? [])
      .filter((l) => l.competitions)
      .sort((a, b) => (a.competitions?.display_order ?? 0) - (b.competitions?.display_order ?? 0));

  const ctaColorFor = (r: RoundRow): 'gg-copper' | 'gg-green' => {
    const slugs = roundComps(r).map((l) => l.competitions!.slug);
    const isCup = slugs.includes('galaxycup');
    const isCircuito = slugs.includes('circuito-galaxygolf') || slugs.includes('circuito');
    return isCup && !isCircuito ? 'gg-copper' : 'gg-green';
  };

  return (
    <div className="animate-fade-in bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))]">
      {/* ——— ACCESOS A COMPETICIONES (HERO) ——— */}
      <section className="relative overflow-hidden border-b border-[hsl(var(--gg-gold))]/20">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroUrl})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--gg-bg-light))] via-transparent to-transparent"
        />
        <div className="container relative pt-10 pb-8">
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
            <div
              aria-hidden
              className="absolute inset-0 bg-[hsl(var(--gg-bg-light))]/[0.82]"
            />
            <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-[hsl(var(--gg-green))]/55" />
            <p className="relative text-xs font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-green))] mb-4">
              Circuito
            </p>
            <div className="relative flex-1 flex flex-col justify-center items-center w-full">
              <div className="pt-3">
                <CompetitionWordmark variant="circuito" />
              </div>
              <p className="text-[11px] text-[hsl(var(--gg-navy-deep))]/70 leading-relaxed mt-5 max-w-[26ch]">
                Ranking anual por categorías, pruebas regulares y Gran Final.
              </p>
            </div>
            <div className="relative mt-6">
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
            <div
              aria-hidden
              className="absolute inset-0 bg-[hsl(var(--gg-bg-light))]/[0.82]"
            />
            <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-[hsl(var(--gg-copper))]/55" />
            <p className="relative text-xs font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-copper))] mb-4">
              Race to the Playoffs
            </p>
            <div className="relative flex-1 flex flex-col justify-center items-center w-full">
              <CompetitionWordmark variant="galaxycup" />
              <p className="text-[11px] text-[hsl(var(--gg-navy-deep))]/70 leading-relaxed mt-5 max-w-[26ch]">
                Competición por puntos con Majors y Playoffs.
              </p>
            </div>
            <div className="relative mt-6">
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
        </div>
      </section>


      {/* ——— ÚLTIMOS RESULTADOS PUBLICADOS ——— */}
      <section className="container pb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-gold))]">
            Últimos resultados publicados
          </span>
          <div className="h-px flex-1 bg-[hsl(var(--gg-border-light))]" />
        </div>

        {rounds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {rounds.map((r) => {
              const comps = roundComps(r);
              const cta = ctaColorFor(r);
              return (
                <article
                  key={r.id}
                  className="border border-[hsl(var(--gg-border-light))] bg-[hsl(var(--gg-surface-light))] px-4 py-3 flex flex-col gap-2 shadow-[0_2px_14px_-12px_rgba(11,19,36,0.18)]"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {comps.map((l) => (
                      <span
                        key={l.competitions!.slug}
                        className={`text-[9px] font-semibold tracking-[0.22em] uppercase px-1.5 py-0.5 border ${
                          l.competitions!.slug === 'galaxycup'
                            ? 'text-[hsl(var(--gg-copper))] border-[hsl(var(--gg-copper))]/45'
                            : 'text-[hsl(var(--gg-green))] border-[hsl(var(--gg-green))]/45'
                        }`}
                      >
                        {l.competitions!.name}
                      </span>
                    ))}
                  </div>
                  <h3 className="font-display text-[15px] leading-snug text-[hsl(var(--gg-navy-deep))] truncate">
                    {roundLabel(r)}
                  </h3>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-[hsl(var(--gg-navy-deep))]/65">
                      <Calendar className="h-3 w-3" />
                      {formatDate(r.date)}
                    </span>
                    <Link
                      to={`/jornades?round=${r.id}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-[9.5px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                        cta === 'gg-copper'
                          ? 'bg-[hsl(var(--gg-copper))] hover:bg-[hsl(var(--gg-copper))]/85'
                          : 'bg-[hsl(var(--gg-green))] hover:bg-[hsl(var(--gg-green))]/85'
                      }`}
                    >
                      Ver resultados
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-[hsl(var(--gg-border-light))] bg-[hsl(var(--gg-bg-light))] p-4 text-center">
            <p className="text-[12px] text-[hsl(var(--gg-navy-deep))]/65 italic">
              Los resultados aparecerán cuando se publique la primera prueba.
            </p>
          </div>
        )}
      </section>

      {/* ——— SPONSORS STRIP ——— */}
      <SponsorsStrip />

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
    <div className="select-none flex justify-center w-full overflow-visible">
      <img
        src={src}
        alt={alt}
        className={`w-auto object-contain mx-auto block max-h-[72px] sm:max-h-[90px] lg:max-h-[120px] ${
          isCircuito ? 'max-w-[260px] sm:max-w-[380px] lg:max-w-[460px]' : 'max-w-[200px] sm:max-w-[280px] lg:max-w-[340px]'
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
