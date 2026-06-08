import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Flag, TrendingUp, BarChart3, Award, Target } from "lucide-react";

import {
  fetchPublicCircuitData,
  publicCircuitDataQueryKey,
  type PublicResult,
} from "@/lib/publicCircuitData";
import { computeCircuito, computeGalaxyCup } from "./Rankings";
import {
  getGalaxyGolfCategoryByHandicap,
  getGalaxyGolfCategoryLabel,
} from "@/lib/playerCategoryHandicap";
import heroCircuito from "@/assets/hero-circuito.jpg";

/* ============================================================
 * Stats GalaxyGolf 2026
 * Dashboard editorial premium (light) — solo datos reales.
 * ============================================================ */

type Category = "hcp_low" | "hcp_high";

const isCompleted = (r: PublicResult) =>
  (r.result_status ?? "completed") === "completed";

const venueName = (r: PublicResult) =>
  r.rounds?.club?.trim() ||
  r.rounds?.course?.trim() ||
  r.rounds?.name?.trim() ||
  "—";

const fmtDate = (d?: string | null) => {
  if (!d) return "";
  const [y, m, dd] = d.split("-");
  if (!y || !m || !dd) return d;
  return `${dd}/${m}/${y}`;
};

const sortKey = (r: PublicResult) => {
  const d = r.rounds?.date || r.play_date || "9999-99-99";
  const n = String(r.rounds?.round_number ?? 9999).padStart(4, "0");
  return `${d}|${n}|${r.created_at || ""}`;
};

function playerCategoryMap(results: PublicResult[]) {
  const byPlayer = new Map<string, PublicResult[]>();
  for (const r of results) {
    const arr = byPlayer.get(r.player_id) ?? [];
    arr.push(r);
    byPlayer.set(r.player_id, arr);
  }
  const map = new Map<string, Category>();
  for (const [pid, list] of byPlayer.entries()) {
    const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const first = sorted.find((r) => r.handicap_at_round != null);
    const cat = getGalaxyGolfCategoryByHandicap(Number(first?.handicap_at_round ?? NaN));
    if (cat) map.set(pid, cat);
  }
  return map;
}

/* ===================== Componentes UI ===================== */

function Panel({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-[hsl(var(--gg-navy-deep))]/10 bg-[hsl(var(--gg-surface-light))] p-6 md:p-7 shadow-[0_4px_16px_-10px_rgba(11,19,36,0.10)] ${className}`}
    >
      <header className="flex items-center gap-2 mb-5 pb-3 border-b border-[hsl(var(--gg-navy-deep))]/10">
        {icon && <span className="text-[hsl(var(--gg-copper))]">{icon}</span>}
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--gg-navy-deep))]/80">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-[hsl(var(--gg-navy-deep))]/65 italic">
      {text}
    </div>
  );
}

function LeaderRow({
  rank,
  name,
  meta,
  value,
  valueHint,
}: {
  rank?: number;
  name: string | null;
  meta?: string;
  value: React.ReactNode;
  valueHint?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--gg-navy-deep))]/8 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        {rank != null && (
          <span className="flex-shrink-0 w-6 h-6 rounded-full border border-[hsl(var(--gg-gold))]/60 text-[10px] font-semibold flex items-center justify-center text-[hsl(var(--gg-copper))] tabular-nums">
            {rank}
          </span>
        )}
        <div className="min-w-0">
          <div className="font-display text-[15px] text-[hsl(var(--gg-navy-deep))] truncate">
            {name || "Pendiente"}
          </div>
          {meta && (
            <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/65 mt-0.5">
              {meta}
            </div>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0 pl-3">
        <div className="font-sans font-bold text-lg text-[hsl(var(--gg-green))] tabular-nums leading-none">
          {value}
        </div>
        {valueHint && (
          <div className="text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--gg-navy-deep))]/60 mt-1">
            {valueHint}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Página ===================== */

export default function Stats() {
  const { data, isLoading } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
  });

  const [bestTab, setBestTab] = useState<"hcp_low" | "hcp_high" | "scratch">("hcp_low");

  const completedResults = useMemo(
    () => (data?.results ?? []).filter(isCompleted),
    [data],
  );

  const circuito = useMemo(
    () => (data ? computeCircuito(data.results, data.round_competitions) : []),
    [data],
  );
  const galaxyCup = useMemo(
    () => (data ? computeGalaxyCup(data.results, data.round_competitions) : []),
    [data],
  );

  const catMap = useMemo(() => playerCategoryMap(data?.results ?? []), [data]);

  /* Header counters */
  const jornadasDisputadas = useMemo(() => {
    const ids = new Set<string>();
    for (const r of completedResults) if (r.round_id) ids.add(r.round_id);
    return ids.size;
  }, [completedResults]);

  const jugadoresEnRanking = useMemo(() => {
    const ids = new Set<string>();
    for (const r of completedResults) ids.add(r.player_id);
    return ids.size;
  }, [completedResults]);

  /* Líderes por categoría */
  const leaders = useMemo(() => {
    const circLow = circuito.find((r) => r.category === "hcp_low");
    const circHigh = circuito.find((r) => r.category === "hcp_high");
    const cupLow = galaxyCup.find((r) => r.category === "hcp_low");
    const cupHigh = galaxyCup.find((r) => r.category === "hcp_high");
    return [
      { comp: "Circuito GalaxyGolf", cat: getGalaxyGolfCategoryLabel("hcp_low"), name: circLow?.name ?? null, value: circLow?.total ?? null, hint: "pts" },
      { comp: "Circuito GalaxyGolf", cat: getGalaxyGolfCategoryLabel("hcp_high"), name: circHigh?.name ?? null, value: circHigh?.total ?? null, hint: "pts" },
      { comp: "GalaxyCup", cat: getGalaxyGolfCategoryLabel("hcp_low"), name: cupLow?.name ?? null, value: cupLow?.points ?? null, hint: "pts" },
      { comp: "GalaxyCup", cat: getGalaxyGolfCategoryLabel("hcp_high"), name: cupHigh?.name ?? null, value: cupHigh?.points ?? null, hint: "pts" },
    ];
  }, [circuito, galaxyCup]);

  /* Mejores vueltas */
  const bestStableford = (cat: Category) =>
    completedResults
      .filter((r) => catMap.get(r.player_id) === cat && r.stableford_points != null)
      .sort((a, b) => Number(b.stableford_points) - Number(a.stableford_points))
      .slice(0, 5);

  const bestLow = useMemo(() => bestStableford("hcp_low"), [completedResults, catMap]);
  const bestHigh = useMemo(() => bestStableford("hcp_high"), [completedResults, catMap]);
  const bestScratch = useMemo(
    () =>
      completedResults
        .filter((r) => r.scratch_score != null)
        .sort((a, b) => Number(a.scratch_score) - Number(b.scratch_score))
        .slice(0, 5),
    [completedResults],
  );

  const bestList =
    bestTab === "hcp_low" ? bestLow : bestTab === "hcp_high" ? bestHigh : bestScratch;

  /* Promedios */
  const promedios = useMemo(() => {
    const completed = completedResults.filter((r) => r.stableford_points != null);
    const avg = (arr: PublicResult[]) =>
      arr.length === 0
        ? null
        : arr.reduce((s, r) => s + Number(r.stableford_points), 0) / arr.length;
    const low = completed.filter((r) => catMap.get(r.player_id) === "hcp_low");
    const high = completed.filter((r) => catMap.get(r.player_id) === "hcp_high");
    return {
      general: avg(completed),
      low: avg(low),
      high: avg(high),
      totalResults: completed.length,
      jornadas: jornadasDisputadas,
      jugadores: jugadoresEnRanking,
    };
  }, [completedResults, catMap, jornadasDisputadas, jugadoresEnRanking]);

  /* Birdies y hoyos — solo con scorecards de golpes reales */
  type Strokes = { result: PublicResult; scores: number[]; par: number[] };
  const reliableStrokes = useMemo<Strokes[]>(() => {
    const out: Strokes[] = [];
    for (const r of completedResults) {
      const sc = r.scorecard as any;
      if (!sc || typeof sc !== "object") continue;
      if (sc.mode === "stableford_points") continue;
      const scores = Array.isArray(sc.scores) ? sc.scores : null;
      const par = Array.isArray(r.rounds?.course_par) ? (r.rounds!.course_par as number[]) : null;
      if (!scores || !par || scores.length !== 18 || par.length !== 18) continue;
      const validShots = scores.every((s: any) => typeof s === "number" && s > 0);
      if (!validShots) continue;
      out.push({ result: r, scores, par });
    }
    return out;
  }, [completedResults]);

  const birdiesData = useMemo(() => {
    if (reliableStrokes.length === 0) return null;
    let totalBirdies = 0;
    const byPlayer = new Map<string, { name: string; count: number }>();
    for (const s of reliableStrokes) {
      let birds = 0;
      for (let i = 0; i < 18; i++) {
        if (s.scores[i] === s.par[i] - 1 || s.scores[i] === s.par[i] - 2 || s.scores[i] === s.par[i] - 3) {
          // birdie or better — count as birdie+
          if (s.scores[i] <= s.par[i] - 1) birds++;
        }
      }
      totalBirdies += birds;
      const name = s.result.players_public?.name ?? "—";
      const prev = byPlayer.get(s.result.player_id) ?? { name, count: 0 };
      prev.count += birds;
      byPlayer.set(s.result.player_id, prev);
    }
    const top = [...byPlayer.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    return { totalBirdies, top, sample: reliableStrokes.length };
  }, [reliableStrokes]);

  const holesData = useMemo(() => {
    if (reliableStrokes.length < 5) return null;
    // Group by round → average diff vs par per hole
    const totals = Array.from({ length: 18 }, () => ({ sum: 0, count: 0, par: 0 }));
    for (const s of reliableStrokes) {
      for (let i = 0; i < 18; i++) {
        totals[i].sum += s.scores[i];
        totals[i].count += 1;
        totals[i].par = s.par[i];
      }
    }
    const holes = totals.map((t, i) => ({
      hole: i + 1,
      par: t.par,
      avg: t.count > 0 ? t.sum / t.count : null,
      diff: t.count > 0 ? t.sum / t.count - t.par : null,
    }));
    const valid = holes.filter((h) => h.diff != null);
    if (valid.length === 0) return null;
    const hard = [...valid].sort((a, b) => (b.diff! - a.diff!)).slice(0, 3);
    const easy = [...valid].sort((a, b) => (a.diff! - b.diff!)).slice(0, 3);
    return { hard, easy };
  }, [reliableStrokes]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))] border-b border-[hsl(var(--gg-gold))]/20">
        <img
          src={heroCircuito}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--gg-bg-light))]/95 from-0% via-[hsl(var(--gg-bg-light))]/72 via-45% to-[hsl(var(--gg-bg-light))]/18"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--gg-bg-light))] via-transparent to-transparent"
        />
        <div className="container relative mx-auto px-4 py-12 md:py-16">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-end">
            <div>
              <p className="mb-5 text-[10px] font-semibold tracking-[0.32em] text-[hsl(var(--gg-green))]">
                TEMPORADA 2026
              </p>
              <h1
                className="font-display font-light leading-[1.05] text-[hsl(var(--gg-navy-deep))]"
                style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}
              >
                Estadísticas
              </h1>
              <p className="mt-6 max-w-xl text-base md:text-lg text-[hsl(var(--gg-navy-deep))]/80 font-light">
                Datos que cuentan. Rendimiento que inspira.
              </p>
            </div>
            <div className="flex lg:justify-end">
              <div
                className="relative w-full max-w-sm border border-[hsl(var(--gg-navy-deep))]/12 bg-[hsl(var(--gg-surface-light))] text-[hsl(var(--gg-navy-deep))] p-6 md:p-7 shadow-[0_12px_32px_-12px_rgba(11,19,36,0.14)]"
                style={{ borderTop: "2px solid hsl(var(--gg-copper))" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <Trophy className="h-5 w-5 text-[hsl(var(--gg-copper))]" />
                  <span className="text-[10px] uppercase tracking-[0.28em] text-[hsl(var(--gg-navy-deep))]/70">
                    Temporada en curso
                  </span>
                </div>
                <div className="font-display text-5xl font-light leading-none mb-5 text-[hsl(var(--gg-green))]">
                  2026
                </div>
                <div className="space-y-3 pt-4 border-t border-[hsl(var(--gg-navy-deep))]/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--gg-navy-deep))]/65">
                      Jornadas disputadas
                    </span>
                    <span className="font-sans font-semibold text-xl tabular-nums text-[hsl(var(--gg-copper))]">
                      {isLoading ? "—" : jornadasDisputadas}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--gg-navy-deep))]/65">
                      Jugadores en ranking
                    </span>
                    <span className="font-sans font-semibold text-xl tabular-nums text-[hsl(var(--gg-copper))]">
                      {isLoading ? "—" : jugadoresEnRanking}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section className="bg-[hsl(var(--gg-bg-light))] pb-20 pt-10 md:pt-14">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Líderes */}
            <Panel title="Líderes por categoría" icon={<Award className="h-4 w-4" />}>
              {isLoading ? (
                <EmptyState text="Cargando…" />
              ) : (
                <div className="space-y-5">
                  {(["Circuito GalaxyGolf", "GalaxyCup"] as const).map((comp) => (
                    <div key={comp}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--gg-copper))] mb-1">
                        {comp}
                      </div>
                      {leaders
                        .filter((l) => l.comp === comp)
                        .map((l, i) => (
                          <LeaderRow
                            key={`${comp}-${i}`}
                            name={l.name}
                            meta={l.cat}
                            value={l.value ?? "—"}
                            valueHint={l.value != null ? l.hint : undefined}
                          />
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Mejores vueltas */}
            <Panel title="Mejores vueltas" icon={<Trophy className="h-4 w-4" />}>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[hsl(var(--gg-surface-light))] mb-4 border border-[hsl(var(--gg-navy-deep))]/10">
                {([
                  ["hcp_low", "Hcp Inferior"],
                  ["hcp_high", "Hcp Superior"],
                  ["scratch", "Scratch"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setBestTab(key)}
                    className={`text-[10px] uppercase tracking-[0.18em] py-2 transition-colors ${
                      bestTab === key
                        ? "bg-[hsl(var(--gg-green))] text-[hsl(var(--gg-ivory))] bg-[#c78a66]"
                        : "bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))]/70 hover:text-[hsl(var(--gg-navy-deep))]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {bestList.length === 0 ? (
                <EmptyState
                  text={
                    bestTab === "scratch"
                      ? "Datos scratch no disponibles."
                      : "Datos no disponibles todavía"
                  }
                />
              ) : (
                <div>
                  {bestList.map((r, i) => (
                    <LeaderRow
                      key={r.id}
                      rank={i + 1}
                      name={r.players_public?.name ?? "—"}
                      meta={`${venueName(r)} · ${fmtDate(r.rounds?.date || r.play_date)}`}
                      value={
                        bestTab === "scratch"
                          ? Number(r.scratch_score)
                          : Number(r.stableford_points)
                      }
                      valueHint={bestTab === "scratch" ? "golpes" : "pts"}
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* Birdies */}
            <Panel title="Birdies" icon={<Flag className="h-4 w-4" />}>
              {birdiesData == null ? (
                <EmptyState text="Birdies no disponibles con los datos actuales." />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-5 pb-5 border-b border-[hsl(var(--gg-navy-deep))]/10">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/65">
                        Total temporada
                      </div>
                      <div className="font-display text-2xl text-[hsl(var(--gg-navy-deep))] mt-1">
                        {birdiesData.totalBirdies}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/65">
                        Tarjetas usadas
                      </div>
                      <div className="font-display text-2xl text-[hsl(var(--gg-copper))] mt-1">
                        {birdiesData.sample}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--gg-copper))] mb-2">
                    Top jugadores
                  </div>
                  {birdiesData.top.map((p, i) => (
                    <LeaderRow
                      key={p.name + i}
                      rank={i + 1}
                      name={p.name}
                      value={p.count}
                      valueHint="birdies"
                    />
                  ))}
                </>
              )}
            </Panel>
          </div>

          {/* Segunda fila */}
          <div className="grid lg:grid-cols-3 gap-6 mt-6">
            {/* Hoyos difíciles */}
            <Panel title="Hoyos más difíciles" icon={<TrendingUp className="h-4 w-4" />}>
              {holesData == null ? (
                <EmptyState text="Datos no disponibles todavía" />
              ) : (
                holesData.hard.map((h, i) => (
                  <LeaderRow
                    key={h.hole}
                    rank={i + 1}
                    name={`Hoyo ${h.hole}`}
                    meta={`Par ${h.par}`}
                    value={h.avg?.toFixed(2)}
                    valueHint="promedio"
                  />
                ))
              )}
            </Panel>

            {/* Hoyos fáciles */}
            <Panel title="Hoyos más fáciles" icon={<Target className="h-4 w-4" />}>
              {holesData == null ? (
                <EmptyState text="Datos no disponibles todavía" />
              ) : (
                holesData.easy.map((h, i) => (
                  <LeaderRow
                    key={h.hole}
                    rank={i + 1}
                    name={`Hoyo ${h.hole}`}
                    meta={`Par ${h.par}`}
                    value={h.avg?.toFixed(2)}
                    valueHint="promedio"
                  />
                ))
              )}
            </Panel>

            {/* Promedios */}
            <Panel title="Promedios generales" icon={<BarChart3 className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Metric
                  label="Stableford general"
                  value={promedios.general?.toFixed(1) ?? "—"}
                />
                <Metric
                  label="Stableford Hcp Inferior"
                  value={promedios.low?.toFixed(1) ?? "—"}
                />
                <Metric
                  label="Stableford Hcp Superior"
                  value={promedios.high?.toFixed(1) ?? "—"}
                />
                <Metric label="Resultados completados" value={promedios.totalResults} />
                <Metric label="Jornadas publicadas" value={promedios.jornadas} />
                <Metric label="Jugadores con resultados" value={promedios.jugadores} />
              </div>
            </Panel>
          </div>
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/65">
        {label}
      </div>
      <div className="font-display text-2xl text-[hsl(var(--gg-navy-deep))] mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}
