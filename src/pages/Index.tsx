import heroBg from '@/assets/hero-landscape.png';
import { Link } from 'react-router-dom';
import { ArrowRight, Trophy, CalendarDays } from 'lucide-react';

const Index = () => {
  const scrollToCompeticiones = () => {
    const el = document.getElementById('competiciones');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="animate-fade-in bg-[hsl(var(--gg-navy))] text-[hsl(var(--gg-ivory))]">
      {/* ——— HERO ——— */}
      <section className="relative min-h-[68vh] overflow-hidden flex items-center">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover object-center" />
        </div>
        {/* Overlay lateral cálido para apoyo del titular */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--gg-bg-light))]/95 from-0% via-[hsl(var(--gg-bg-light))]/70 via-45% to-[hsl(var(--gg-bg-light))]/15 to-100%" />
        {/* Fundido inferior con el fondo de página */}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--gg-bg-light))] via-transparent to-transparent" />

        <div className="relative z-10 container py-16 max-w-3xl">
          <p className="text-[11px] font-semibold tracking-[0.35em] uppercase text-[hsl(var(--gg-gold))] mb-4">
            Temporada 2026
          </p>
          <h1 className="font-display text-5xl lg:text-7xl font-medium leading-[0.95] mb-5 text-[hsl(var(--gg-navy-deep))]">
            La temporada<br />está en juego
          </h1>
          <p className="text-base lg:text-lg text-[hsl(var(--gg-text-muted))] leading-relaxed mb-8 max-w-xl">
            Sigue los torneos, el calendario y las clasificaciones del Circuito GALAXY GOLF y la GalaxyCup 2026.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/jornades"
              className="inline-flex items-center justify-center gap-3 px-7 py-4 bg-[hsl(var(--gg-green))] text-[hsl(var(--gg-surface-light))] text-[11px] font-semibold uppercase tracking-[0.22em] shadow-[0_8px_24px_-12px_rgba(11,19,36,0.4)] hover:bg-[hsl(var(--gg-green))]/85 transition-colors"
            >
              Ver calendario
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={scrollToCompeticiones}
              className="inline-flex items-center justify-center gap-3 px-7 py-4 bg-[hsl(var(--gg-surface-light))]/70 backdrop-blur-[2px] border border-[hsl(var(--gg-navy-deep))]/30 text-[hsl(var(--gg-navy-deep))] text-[11px] font-semibold uppercase tracking-[0.22em] hover:bg-[hsl(var(--gg-surface-light))] hover:border-[hsl(var(--gg-gold))] transition-colors"
            >
              Ver competiciones
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ——— SPONSORS STRIP (institucional, discreto) ——— */}
      <section className="border-y border-[hsl(var(--gg-gold))]/15 bg-[hsl(var(--gg-navy))]">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-gold))]/70 shrink-0">
              Patrocinadores oficiales
            </p>
            <div className="flex-1 grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-3 items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 flex items-center justify-center text-[10px] font-semibold tracking-[0.22em] uppercase text-[hsl(var(--gg-ivory))]/30"
                >
                  Sponsor
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ——— COMPETICIONES ——— */}
      <section id="competiciones" className="container py-14">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-1 bg-[hsl(var(--gg-gold))]/20" />
          <h2 className="text-[11px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-gold))]">
            Competiciones 2026
          </h2>
          <div className="h-px flex-1 bg-[hsl(var(--gg-gold))]/20" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Circuito GalaxyGolf */}
          <article className="relative overflow-hidden border border-[hsl(var(--gg-green))]/25 bg-[hsl(var(--gg-green))]/12 p-10 flex flex-col group hover:border-[hsl(var(--gg-green))]/50 transition-colors shadow-[0_2px_24px_-12px_rgba(11,19,36,0.18)]">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gg-gold))]/60 to-transparent" />
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-full border border-[hsl(var(--gg-green))]/50 flex items-center justify-center bg-[hsl(var(--gg-surface-light))]/60">
                <span className="font-display text-xl text-[hsl(var(--gg-green))]">G</span>
              </div>
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-green))]">
                Temporada 2026
              </p>
            </div>
            <h3 className="font-display text-4xl mb-3 text-[hsl(var(--gg-navy-deep))]">Circuito GALAXY GOLF</h3>
            <p className="text-[hsl(var(--gg-navy-deep))]/80 leading-relaxed mb-6">
              Ranking anual, pruebas regulares y Gran Final.
            </p>
            <span className="inline-flex self-start px-3 py-1.5 mb-8 text-[10px] font-semibold tracking-[0.18em] uppercase border border-[hsl(var(--gg-green))]/40 text-[hsl(var(--gg-green))] bg-[hsl(var(--gg-surface-light))]/50">
              12 pruebas + Gran Final
            </span>
            <div className="mt-auto flex items-center gap-6">
              <Link
                to="/circuito-galaxygolf"
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--gg-green))] hover:text-[hsl(var(--gg-navy-deep))] transition-colors"
              >
                Ver ranking <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/jornades"
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/60 hover:text-[hsl(var(--gg-navy-deep))] transition-colors"
              >
                Ver calendario
              </Link>
            </div>
          </article>

          {/* GalaxyCup */}
          <article className="relative overflow-hidden border border-[hsl(var(--gg-gold))]/20 bg-[hsl(var(--gg-navy))] p-10 flex flex-col group hover:border-[hsl(var(--gg-gold))]/50 transition-colors">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gg-copper))]/60 to-transparent" />
            <div className="flex items-center gap-4 mb-6">
              <Trophy className="h-10 w-10 text-[hsl(var(--gg-copper))]" strokeWidth={1.2} />
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-copper))]">
                Race to the Playoffs
              </p>
            </div>
            <h3 className="font-display text-4xl mb-3 text-[hsl(var(--gg-ivory))]">GalaxyCup</h3>
            <p className="text-[hsl(var(--gg-ivory))]/70 leading-relaxed mb-6">
              Competición por puntos con Majors y Playoffs.
            </p>
            <span className="inline-flex self-start px-3 py-1.5 mb-8 text-[10px] font-semibold tracking-[0.18em] uppercase border border-[hsl(var(--gg-copper))]/50 text-[hsl(var(--gg-copper))]">
              Fase regular + Playoffs
            </span>
            <div className="mt-auto flex items-center gap-6">
              <Link
                to="/galaxycup"
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--gg-copper))] hover:text-[hsl(var(--gg-ivory))] transition-colors"
              >
                Ver ranking <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/jornades"
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--gg-ivory))]/55 hover:text-[hsl(var(--gg-ivory))] transition-colors"
              >
                Ver calendario
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* ——— SEASON STATS ——— */}
      <section className="border-t border-[hsl(var(--gg-gold))]/15 bg-[hsl(var(--gg-navy))]">
        <div className="container py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <StaticStat value="2" label="Competiciones" />
          <StaticStat value="29" label="Jornadas" />
          <StaticStat value="2026" label="Temporada" icon={<CalendarDays className="h-5 w-5 text-[hsl(var(--gg-gold))]/70" />} />
        </div>
      </section>
    </div>
  );
};

function StaticStat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {icon}
      <span className="font-display text-5xl text-[hsl(var(--gg-ivory))]">{value}</span>
      <span className="text-[11px] font-semibold tracking-[0.25em] uppercase text-[hsl(var(--gg-gold))]/80">
        {label}
      </span>
    </div>
  );
}

export default Index;
