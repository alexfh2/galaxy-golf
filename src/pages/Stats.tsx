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
import PlayerProfileDialog from "@/components/PlayerProfileDialog";

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
  onNameClick,
}: {
  rank?: number;
  name: string | null;
  meta?: string;
  value: React.ReactNode;
  valueHint?: string;
  onNameClick?: () => void;
}) {
  const nameNode = name || "Pendiente";
  return (
    <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--gg-navy-deep))]/8 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        {rank != null && (
          <span className="flex-shrink-0 w-6 h-6 rounded-full border border-[hsl(var(--gg-gold))]/60 text-[10px] font-semibold flex items-center justify-center text-[hsl(var(--gg-copper))] tabular-nums">
            {rank}
          </span>
        )}
        <div className="min-w-0">
          {onNameClick && name ? (
            <button
              type="button"
              onClick={onNameClick}
              className="font-display text-[15px] text-[hsl(var(--gg-navy-deep))] truncate text-left cursor-pointer hover:text-[hsl(var(--gg-copper))] transition-colors"
            >
              {nameNode}
            </button>
          ) : (
            <div className="font-display text-[15px] text-[hsl(var(--gg-navy-deep))] truncate">
              {nameNode}
            </div>
          )}
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
  const [scope, setScope] = useState<"all" | "circuito" | "galaxycup">("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const openPlayer = (id?: string | null) => {
    if (id) setSelectedPlayerId(id);
  };

  /* Round id sets per competition scope */
  const roundIdsByScope = useMemo(() => {
    const circ = new Set<string>();
    const cup = new Set<string>();
    for (const rc of data?.round_competitions ?? []) {
      const slug = rc.competition?.slug;
      if (slug === "circuito-galaxygolf") circ.add(rc.round_id);
      else if (slug === "galaxycup") cup.add(rc.round_id);
    }
    return { circ, cup };
  }, [data]);

  const scopedResults = useMemo(() => {
    const all = data?.results ?? [];
    if (scope === "circuito") return all.filter((r) => roundIdsByScope.circ.has(r.round_id));
    if (scope === "galaxycup") return all.filter((r) => roundIdsByScope.cup.has(r.round_id));
    return all;
  }, [data, scope, roundIdsByScope]);

  const completedResults = useMemo(
    () => scopedResults.filter(isCompleted),
    [scopedResults],
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

  const totalJornadas = useMemo(() => {
    if (scope === "circuito") return roundIdsByScope.circ.size;
    if (scope === "galaxycup") return roundIdsByScope.cup.size;
    const all = new Set<string>([...roundIdsByScope.circ, ...roundIdsByScope.cup]);
    return all.size;
  }, [scope, roundIdsByScope]);

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
      { comp: "Circuito GalaxyGolf", cat: getGalaxyGolfCategoryLabel("hcp_low"), name: circLow?.name ?? null, player_id: circLow?.player_id ?? null, value: circLow?.total ?? null, hint: "pts" },
      { comp: "Circuito GalaxyGolf", cat: getGalaxyGolfCategoryLabel("hcp_high"), name: circHigh?.name ?? null, player_id: circHigh?.player_id ?? null, value: circHigh?.total ?? null, hint: "pts" },
      { comp: "GalaxyCup", cat: getGalaxyGolfCategoryLabel("hcp_low"), name: cupLow?.name ?? null, player_id: cupLow?.player_id ?? null, value: cupLow?.points ?? null, hint: "pts" },
      { comp: "GalaxyCup", cat: getGalaxyGolfCategoryLabel("hcp_high"), name: cupHigh?.name ?? null, player_id: cupHigh?.player_id ?? null, value: cupHigh?.points ?? null, hint: "pts" },
    ];
  }, [circuito, galaxyCup]);

  /* Mejores vueltas */
  const bestStableford = (cat: Category) =>
    completedResults
      .filter((r) => catMap.get(r.player_id) === cat && r.stableford_points != null)
      .sort((a, b) => Number(b.stableford_points) - Number(a.stableford_points))
    .slice(0, 20);

  const bestLow = useMemo(() => bestStableford("hcp_low"), [completedResults, catMap]);
  const bestHigh = useMemo(() => bestStableford("hcp_high"), [completedResults, catMap]);
  const bestList =
    bestTab === "hcp_low" ? bestLow : bestTab === "hcp_high" ? bestHigh : [];

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

  const bestScratch = useMemo(() => {
    return reliableStrokes
      .map((s) => {
        let pts = 0;
        for (let i = 0; i < 18; i++) {
          pts += Math.max(0, 2 + Number(s.par[i]) - Number(s.scores[i]));
        }
        return { result: s.result, points: pts };
      })
      .sort((a, b) => b.points - a.points)
    .slice(0, 20);
  }, [reliableStrokes]);

  const birdiesData = useMemo(() => {
    if (reliableStrokes.length === 0) return null;
    let totalBirdies = 0;
    const byPlayer = new Map<string, { id: string; name: string; count: number }>();
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
      const prev = byPlayer.get(s.result.player_id) ?? { id: s.result.player_id, name, count: 0 };
      prev.count += birds;
      byPlayer.set(s.result.player_id, prev);
    }
    const top = [...byPlayer.values()].sort((a, b) => b.count - a.count).slice(0, 20);
    return { totalBirdies, top, sample: reliableStrokes.length };
  }, [reliableStrokes]);

  const holesData = useMemo(() => {
    if (reliableStrokes.length < 5) return null;

    // Resolve course name with explicit fallback order: course → club → name → default
    const courseNameOf = (r: PublicResult) =>
      r.rounds?.course?.trim() ||
      r.rounds?.club?.trim() ||
      r.rounds?.name?.trim() ||
      "Campo no especificado";

    // Group strokes by course so averages are per-course (mixing different courses is meaningless)
    const byCourse = new Map<
      string,
      { scores: number[][]; par: number[]; hcp: (number | null)[] }
    >();
    for (const s of reliableStrokes) {
      const course = courseNameOf(s.result);
      const rawHcp = (s.result.rounds as any)?.course_handicap;
      const hcpArr: (number | null)[] = Array.isArray(rawHcp)
        ? (rawHcp as any[]).map((v) => (typeof v === "number" ? v : null))
        : Array.from({ length: 18 }, () => null);
      if (!byCourse.has(course)) {
        byCourse.set(course, { scores: [], par: s.par, hcp: hcpArr });
      }
      byCourse.get(course)!.scores.push(s.scores);
    }

    type CourseHole = {
      hole: number;
      par: number;
      hcp: number | null;
      avg: number | null;
      diff: number | null;
      course: string;
    };
    const allHoles: CourseHole[] = [];

    for (const [course, data] of byCourse.entries()) {
      if (data.scores.length < 3) continue; // need at least 3 rounds for significance
      const totals = Array.from({ length: 18 }, () => ({ sum: 0, count: 0, par: 0 }));
      for (const scores of data.scores) {
        for (let i = 0; i < 18; i++) {
          totals[i].sum += scores[i];
          totals[i].count += 1;
          totals[i].par = data.par[i];
        }
      }
      for (let i = 0; i < 18; i++) {
        const t = totals[i];
        const avg = t.count > 0 ? t.sum / t.count : null;
        const diff = avg != null ? avg - t.par : null;
        allHoles.push({
          hole: i + 1,
          par: t.par,
          hcp: data.hcp[i] ?? null,
          avg,
          diff,
          course,
        });
      }
    }

    const valid = allHoles.filter((h) => h.diff != null);
    if (valid.length === 0) return null;
    const hard = [...valid].sort((a, b) => b.diff! - a.diff!).slice(0, 20);
    const easy = [...valid].sort((a, b) => a.diff! - b.diff!).slice(0, 20);
    return { hard, easy };
  }, [reliableStrokes]);

  /* Campos más difíciles / fáciles — promedio de golpes vs par por vuelta */
  const coursesData = useMemo(() => {
    if (reliableStrokes.length === 0) return null;
    const courseNameOf = (r: PublicResult) =>
      r.rounds?.course?.trim() ||
      r.rounds?.club?.trim() ||
      r.rounds?.name?.trim() ||
      "Campo no especificado";

    type Agg = { name: string; sumDiff: number; sumStrokes: number; sumPar: number; count: number };
    const byCourse = new Map<string, Agg>();
    for (const s of reliableStrokes) {
      const name = courseNameOf(s.result);
      let strokes = 0;
      let par = 0;
      for (let i = 0; i < 18; i++) {
        strokes += Number(s.scores[i]);
        par += Number(s.par[i]);
      }
      const cur = byCourse.get(name) ?? { name, sumDiff: 0, sumStrokes: 0, sumPar: 0, count: 0 };
      cur.sumDiff += strokes - par;
      cur.sumStrokes += strokes;
      cur.sumPar += par;
      cur.count += 1;
      byCourse.set(name, cur);
    }
    const arr = [...byCourse.values()]
      .filter((c) => c.count >= 2)
      .map((c) => ({
        name: c.name,
        avgDiff: c.sumDiff / c.count,
        avgStrokes: c.sumStrokes / c.count,
        avgPar: c.sumPar / c.count,
        rounds: c.count,
      }));
    if (arr.length === 0) return null;
    const hard = [...arr].sort((a, b) => b.avgDiff - a.avgDiff).slice(0, 20);
    const easy = [...arr].sort((a, b) => a.avgDiff - b.avgDiff).slice(0, 20);
    return { hard, easy };
  }, [reliableStrokes]);

  /* Eagles, Albatros & Hole in One */
  const specialScores = useMemo(() => {
    if (reliableStrokes.length === 0) return null;
    type Entry = {
      player_id: string;
      name: string;
      type: "hio" | "albatross" | "eagle";
      hole: number;
      par: number;
      score: number;
      course: string;
      date?: string | null;
    };
    const entries: Entry[] = [];
    for (const s of reliableStrokes) {
      for (let i = 0; i < 18; i++) {
        const sc = Number(s.scores[i]);
        const par = Number(s.par[i]);
        let type: Entry["type"] | null = null;
        if (sc === 1) type = "hio";
        else if (sc === par - 3) type = "albatross";
        else if (sc === par - 2) type = "eagle";
        if (!type) continue;
        entries.push({
          player_id: s.result.player_id,
          name: s.result.players_public?.name ?? "—",
          type,
          hole: i + 1,
          par,
          score: sc,
          course:
            s.result.rounds?.course?.trim() ||
            s.result.rounds?.club?.trim() ||
            s.result.rounds?.name?.trim() ||
            "—",
          date: s.result.rounds?.date || s.result.play_date,
        });
      }
    }
    const counts = { hio: 0, albatross: 0, eagle: 0 };
    for (const e of entries) counts[e.type]++;
    const order: Record<Entry["type"], number> = { hio: 0, albatross: 1, eagle: 2 };
    const list = [...entries].sort((a, b) => {
      if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
      return (b.date ?? "").localeCompare(a.date ?? "");
    }).slice(0, 20);
    return { counts, list, total: entries.length };
  }, [reliableStrokes]);

  const specialLabel = (t: "hio" | "albatross" | "eagle") =>
    t === "hio" ? "Hole in One" : t === "albatross" ? "Albatros" : "Eagle";

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
                      {isLoading ? "—" : `${jornadasDisputadas} / ${totalJornadas}`}
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

      {/* SCOPE TABS */}
      <section className="bg-[hsl(var(--gg-bg-light))] pt-8 md:pt-10">
        <div className="container mx-auto px-4">
          <div className="inline-flex p-1 bg-[hsl(var(--gg-surface-light))] border border-[hsl(var(--gg-navy-deep))]/10">
            {([
              ["all", "Todos"],
              ["circuito", "Circuito GalaxyGolf"],
              ["galaxycup", "GalaxyCup"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setScope(key)}
                style={scope === key ? { backgroundColor: "#c88965" } : undefined}
                className={`text-[10px] uppercase tracking-[0.18em] px-4 py-2 transition-colors ${
                  scope === key
                    ? "text-[hsl(var(--gg-ivory))]"
                    : "text-[hsl(var(--gg-navy-deep))]/70 hover:text-[hsl(var(--gg-navy-deep))]"
                }`}
              >
                {label}
              </button>
            ))}
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
                  {(
                    scope === "circuito"
                      ? (["Circuito GalaxyGolf"] as const)
                      : scope === "galaxycup"
                      ? (["GalaxyCup"] as const)
                      : (["Circuito GalaxyGolf", "GalaxyCup"] as const)
                  ).map((comp) => (
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
                            onNameClick={l.player_id ? () => openPlayer(l.player_id) : undefined}
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
                    style={bestTab === key ? { backgroundColor: "#c78a66" } : undefined}
                    className={`text-[10px] uppercase tracking-[0.18em] py-2 transition-colors ${
                      bestTab === key
                        ? "text-[hsl(var(--gg-ivory))]"
                        : "bg-[hsl(var(--gg-bg-light))] text-[hsl(var(--gg-navy-deep))]/70 hover:text-[hsl(var(--gg-navy-deep))]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {bestTab === "scratch" ? (
                bestScratch.length === 0 ? (
                  <EmptyState text="Datos scratch no disponibles con los datos actuales." />
                ) : (
                  <div className="max-h-[280px] overflow-y-auto">
                    {bestScratch.map((s, i) => (
                      <LeaderRow
                        key={s.result.id}
                        rank={i + 1}
                        name={s.result.players_public?.name ?? "—"}
                        meta={`${venueName(s.result)} · ${fmtDate(s.result.rounds?.date || s.result.play_date)}`}
                        value={s.points}
                        valueHint="pts"
                        onNameClick={() => openPlayer(s.result.player_id)}
                      />
                    ))}
                  </div>
                )
              ) : bestList.length === 0 ? (
                <EmptyState text="Datos no disponibles todavía" />
              ) : (
                <div className="max-h-[280px] overflow-y-auto">
                  {bestList.map((r, i) => (
                    <LeaderRow
                      key={r.id}
                      rank={i + 1}
                      name={r.players_public?.name ?? "—"}
                      meta={`${venueName(r)} · ${fmtDate(r.rounds?.date || r.play_date)}`}
                      value={Number(r.stableford_points)}
                      valueHint="pts"
                      onNameClick={() => openPlayer(r.player_id)}
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
                  <div className="max-h-[280px] overflow-y-auto">
                    {birdiesData.top.map((p, i) => (
                      <LeaderRow
                        key={p.id + i}
                        rank={i + 1}
                        name={p.name}
                        value={p.count}
                        valueHint="birdies"
                        onNameClick={() => openPlayer(p.id)}
                      />
                    ))}
                  </div>
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
                <div className="max-h-[280px] overflow-y-auto">
                  {holesData.hard.map((h, i) => (
                    <LeaderRow
                      key={`${h.course}__${h.hole}`}
                      rank={i + 1}
                      name={`Hoyo ${h.hole}`}
                      meta={`${h.course} · Par ${h.par}${h.hcp != null ? ` · HCP ${h.hcp}` : ""}`}
                      value={h.avg?.toFixed(2)}
                      valueHint="Promedio"
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* Hoyos fáciles */}
            <Panel title="Hoyos más fáciles" icon={<Target className="h-4 w-4" />}>
              {holesData == null ? (
                <EmptyState text="Datos no disponibles todavía" />
              ) : (
                <div className="max-h-[280px] overflow-y-auto">
                  {holesData.easy.map((h, i) => (
                    <LeaderRow
                      key={`${h.course}__${h.hole}`}
                      rank={i + 1}
                      name={`Hoyo ${h.hole}`}
                      meta={`${h.course} · Par ${h.par}${h.hcp != null ? ` · HCP ${h.hcp}` : ""}`}
                      value={h.avg?.toFixed(2)}
                      valueHint="Promedio"
                    />
                  ))}
                </div>
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

          {/* Tercera fila */}
          <div className="grid lg:grid-cols-3 gap-6 mt-6">
            {/* Campos más difíciles */}
            <Panel title="Campos más difíciles" icon={<TrendingUp className="h-4 w-4" />}>
              {coursesData == null ? (
                <EmptyState text="Datos no disponibles todavía" />
              ) : (
                <div className="max-h-[280px] overflow-y-auto">
                  {coursesData.hard.map((c, i) => (
                    <LeaderRow
                      key={`hard-${c.name}`}
                      rank={i + 1}
                      name={c.name}
                      meta={`${c.rounds} vuelta${c.rounds === 1 ? "" : "s"} · Par ${Math.round(c.avgPar)}`}
                      value={`${c.avgDiff >= 0 ? "+" : ""}${c.avgDiff.toFixed(1)}`}
                      valueHint="vs Par"
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* Campos más fáciles */}
            <Panel title="Campos más fáciles" icon={<Target className="h-4 w-4" />}>
              {coursesData == null ? (
                <EmptyState text="Datos no disponibles todavía" />
              ) : (
                <div className="max-h-[280px] overflow-y-auto">
                  {coursesData.easy.map((c, i) => (
                    <LeaderRow
                      key={`easy-${c.name}`}
                      rank={i + 1}
                      name={c.name}
                      meta={`${c.rounds} vuelta${c.rounds === 1 ? "" : "s"} · Par ${Math.round(c.avgPar)}`}
                      value={`${c.avgDiff >= 0 ? "+" : ""}${c.avgDiff.toFixed(1)}`}
                      valueHint="vs Par"
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* Eagles, Albatros & Hole in One */}
            <Panel title="Eagles, Albatros & Hole in One" icon={<Flag className="h-4 w-4" />}>
              {specialScores == null || specialScores.total === 0 ? (
                <EmptyState text="Sin registros con los datos actuales." />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-5 pb-5 border-b border-[hsl(var(--gg-navy-deep))]/10">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/65">
                        Hole in One
                      </div>
                      <div className="font-display text-2xl text-[hsl(var(--gg-copper))] mt-1">
                        {specialScores.counts.hio}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/65">
                        Albatros
                      </div>
                      <div className="font-display text-2xl text-[hsl(var(--gg-navy-deep))] mt-1">
                        {specialScores.counts.albatross}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--gg-navy-deep))]/65">
                        Eagles
                      </div>
                      <div className="font-display text-2xl text-[hsl(var(--gg-navy-deep))] mt-1">
                        {specialScores.counts.eagle}
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    {specialScores.list.map((e, i) => (
                      <LeaderRow
                        key={`${e.player_id}-${e.hole}-${e.date ?? i}-${i}`}
                        name={e.name}
                        meta={`${e.course} · Hoyo ${e.hole} (Par ${e.par})${e.date ? ` · ${fmtDate(e.date)}` : ""}`}
                        value={specialLabel(e.type)}
                        onNameClick={() => openPlayer(e.player_id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>
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
