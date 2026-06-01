import { Link } from "react-router-dom";
import { TrendingUp, Trophy, Flag, ArrowRight, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";

// TODO: sustituir esta pantalla editorial por estadísticas reales separadas por
// competición tras validar importación y reglas GalaxyGolf.

export default function Stats() {
  return (
    <>
      {/* Cabecera editorial */}
      <section className="relative overflow-hidden bg-[hsl(var(--gg-navy))] text-[hsl(var(--gg-ivory))]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full border border-[hsl(var(--gg-gold))]/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full border border-[hsl(var(--gg-green))]/40"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full border border-[hsl(var(--gg-gold))]/10"
        />

        <div className="container relative mx-auto px-4 py-20 md:py-28">
          <p className="mb-4 text-xs font-medium tracking-[0.3em] text-[hsl(var(--gg-gold))]">
            TEMPORADA 2026
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-light leading-tight">
            Estadísticas
          </h1>
          <p className="mt-6 max-w-2xl text-base md:text-lg text-[hsl(var(--gg-ivory))]/75">
            Analiza el rendimiento de jugadores, torneos y campos del Circuito
            GALAXY GOLF y la GalaxyCup.
          </p>
        </div>
      </section>

      {/* Aviso informativo */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-3xl rounded-lg border border-[hsl(var(--gg-gold))]/30 bg-[hsl(var(--gg-ivory))]/5 px-6 py-8 text-center">
            <BarChart3 className="mx-auto h-7 w-7 text-[hsl(var(--gg-gold))]" />
            <h2 className="mt-4 font-display text-2xl md:text-3xl text-foreground">
              Estadísticas disponibles próximamente
            </h2>
            <p className="mt-3 text-sm md:text-base text-muted-foreground">
              Las métricas de rendimiento se publicarán tras validar los primeros
              resultados oficiales de la temporada 2026.
            </p>
            <p className="mt-2 text-sm text-muted-foreground/80">
              La plataforma incorporará estadísticas por competición, evolución de
              jugadores y análisis de cada prueba.
            </p>
          </div>
        </div>
      </section>

      {/* Tarjetas informativas */}
      <section className="bg-background pb-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Jugadores */}
            <article className="group relative overflow-hidden rounded-lg border border-border bg-card p-8 transition-colors hover:border-[hsl(var(--gg-gold))]/50">
              <span
                aria-hidden
                className="absolute left-0 top-0 h-full w-1 bg-[hsl(var(--gg-green))]"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.25em] text-[hsl(var(--gg-gold))]">
                    JUGADORES
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-foreground">
                    Evolución y rendimiento
                  </h3>
                </div>
                <TrendingUp className="h-6 w-6 text-[hsl(var(--gg-green))]" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Seguimiento de participación, resultados y progresión durante la
                temporada.
              </p>
            </article>

            {/* Competiciones */}
            <article className="group relative overflow-hidden rounded-lg border border-border bg-card p-8 transition-colors hover:border-[hsl(var(--gg-gold))]/50">
              <span
                aria-hidden
                className="absolute left-0 top-0 h-full w-1 bg-[hsl(var(--gg-copper))]"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.25em] text-[hsl(var(--gg-gold))]">
                    COMPETICIONES
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-foreground">
                    Circuito y GalaxyCup
                  </h3>
                </div>
                <Trophy className="h-6 w-6 text-[hsl(var(--gg-copper))]" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Análisis separado para el ranking anual y la carrera hacia los Playoffs.
              </p>
            </article>

            {/* Torneos */}
            <article className="group relative overflow-hidden rounded-lg border border-border bg-card p-8 transition-colors hover:border-[hsl(var(--gg-gold))]/50">
              <span
                aria-hidden
                className="absolute left-0 top-0 h-full w-1 bg-[hsl(var(--gg-gold))]"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.25em] text-[hsl(var(--gg-gold))]">
                    TORNEOS
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-foreground">
                    Análisis por prueba
                  </h3>
                </div>
                <Flag className="h-6 w-6 text-[hsl(var(--gg-gold))]" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Datos de campo y rendimiento una vez publicados los resultados
                oficiales.
              </p>
            </article>
          </div>

          {/* CTAs */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="bg-[hsl(var(--gg-gold))] text-[hsl(var(--gg-navy))] hover:bg-[hsl(var(--gg-gold))]/90"
            >
              <Link to="/jornades">
                Consultar calendario
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="text-foreground hover:text-[hsl(var(--gg-gold))]">
              <Link to="/ranquings">Ver rankings</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
