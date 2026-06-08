import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error } = await sb.auth.getClaims(token);
  if (error || !claims?.claims) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: claims.claims.sub, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") return true;
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

function validateExternalUrl(raw: string, allowedHosts?: string[]): Response | null {
  let u: URL;
  try { u = new URL(raw); } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid URL" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return new Response(JSON.stringify({ success: false, error: "Only http(s) URLs allowed" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (isPrivateHost(u.hostname)) {
    return new Response(JSON.stringify({ success: false, error: "Disallowed host" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (allowedHosts && allowedHosts.length > 0) {
    const ok = allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
    if (!ok) {
      return new Response(JSON.stringify({ success: false, error: "Host not in allowlist" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
  return null;
}

type ResultStatus = "completed" | "retired" | "no_show" | "disqualified";
type ComputationMode = "stableford_points" | "strokes" | "relative_to_par" | "unknown";

interface ParsedResult {
  position: number;
  name: string;
  license: string;
  gender: string;
  handicap: number | null;
  handicap_play: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  scores: number[];
  source_url: string;
  play_date?: string | null;
  category?: string | null; // Original source category (GolfDirecto/Teeone), kept verbatim for audit.
  result_status?: ResultStatus;
  raw_stableford_points?: number | null;
  _is_senior?: boolean;
  // Diagnostic (per entry): true when stableford was computed from scorecard instead of API value.
  _stableford_computed?: boolean;
}


const RETIRED_TOKENS = new Set([
  "retirado","retirada","retirat","ret","dnf","wd",
  "abandono","abandonado","notermina","noterminanaltarjeta",
  "noentregatarjeta","noentrega","noentregado","noentregada",
  "sintarjeta","nr","ne",
  "noterminado","nofinaliza","nofinalitza",
  // GolfDirecto entry/player.status values
  "notreturned","noreturned","cardnotreturned",
]);
const NOSHOW_TOKENS = new Set([
  "nopresentado","nopresentada","nopresentat","np","dns",
  // GolfDirecto entry/player.status values
  "notpresented","nopresented","absent","ausente",
]);
const DQ_TOKENS = new Set([
  "dq","dsq","descalificado","descalificada","desqualificat","desqualificada",
  "disqualified",
]);


function detectStatus(...values: unknown[]): ResultStatus {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    // Skip pure numbers — they are scores, not status flags.
    if (/^-?\d+([.,]\d+)?$/.test(s)) continue;
    const n = s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    if (!n) continue;
    if (DQ_TOKENS.has(n)) return "disqualified";
    if (NOSHOW_TOKENS.has(n)) return "no_show";
    if (RETIRED_TOKENS.has(n)) return "retired";
  }
  return "completed";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  try {
    const { url, format } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urlErr = validateExternalUrl(url, [
      "golfdirecto.com", "teeone.golf", "teeone.es", "gastronomicgolf.com",
    ]);
    if (urlErr) return urlErr;

    const detectedSource = detectSource(url);
    let results: ParsedResult[];
    let categories: { id: string; name: string; count: number }[] | undefined;
    let course_par: number[] | undefined;
    let course_handicap: number[] | undefined;
    let course_handicap_women: number[] | undefined;
    let game_date: string | null = null;
    let computation_mode: ComputationMode = "stableford_points";
    let requires_split_categories = false;
    let missing_fields: string[] = [];
    let computation_note: string | null = null;

    if (detectedSource === "golfdirecto") {
      const gd = await parseGolfDirecto(url, format);
      results = gd.results;
      categories = gd.categories;
      course_par = gd.course_par;
      course_handicap = gd.course_handicap;
      course_handicap_women = gd.course_handicap_women;
      game_date = gd.game_date ?? null;
      computation_mode = gd.computation_mode;
      requires_split_categories = gd.requires_split_categories;
      missing_fields = gd.missing_fields;
      computation_note = gd.computation_note;
    } else if (detectedSource === "teeone") {
      results = await parseTeeoneViaAPI(url, format);
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const html = await response.text();
      results = parseGenericTable(html, url);
    }

    return new Response(
      JSON.stringify({
        success: true,
        source: detectedSource,
        results,
        count: results.length,
        categories,
        course_par,
        course_handicap,
        course_handicap_women,
        game_date,
        computation_mode,
        requires_split_categories,
        missing_fields,
        computation_note,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function detectSource(url: string): string {
  if (url.includes("golfdirecto.com")) return "golfdirecto";
  if (url.includes("teeone.golf") || url.includes("teeone.es")) return "teeone";
  return "generic";
}

// ─── GOLFDIRECTO ───────────────────────────────────────────────────────────────

interface GolfDirectoResult {
  results: ParsedResult[];
  categories: { id: string; name: string; count: number }[];
  course_par?: number[];
  course_handicap?: number[];
  course_handicap_women?: number[];
  game_date?: string | null;
  computation_mode: ComputationMode;
  requires_split_categories: boolean;
  missing_fields: string[];
  computation_note: string | null;
}


async function parseGolfDirecto(url: string, format?: string): Promise<GolfDirectoResult> {
  const gameMatch = url.match(/game\/([a-f0-9]{24})/);
  if (!gameMatch) {
    throw new Error("No s'ha pogut extreure l'ID del torneig de la URL de GolfDirecto");
  }
  const gameId = gameMatch[1];
  const categoryMatch = url.match(/category=([a-f0-9]{24})/);
  const requestedCategoryId = categoryMatch ? categoryMatch[1] : null;

  const gameRes = await fetch(
    `https://www.golfdirecto.com/web/home/game/${gameId}/active`,
    { headers: { Accept: "application/json" } }
  );
  if (!gameRes.ok) throw new Error(`Error obtenint info del torneig GolfDirecto: ${gameRes.status}`);
  const gameData = await gameRes.json();
  const game = gameData.data || gameData;

  // Extract game date (YYYY-MM-DD) as best-effort play_date fallback
  const rawDate = game.startDate || game.date || game.endDate || null;
  let gameDate: string | null = null;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) gameDate = d.toISOString().slice(0, 10);
  }

  const allCategories: { id: string; name: string; count: number }[] = (game.categories || []).map(
    (c: { _id: string; name: string; __playersCount: number }) => ({
      id: c._id,
      name: c.name || "Sense nom",
      count: c.__playersCount || 0,
    })
  );

  // Determine which category to fetch for results (SCRATCH by default)
  let categoryId = requestedCategoryId;
  if (!categoryId) {
    const scratch = allCategories.find((c) => c.name.toUpperCase().includes("SCRATCH"));
    categoryId = scratch?.id || allCategories[0]?.id;
  }

  if (!categoryId) {
    throw new Error("No s'han trobat categories al torneig de GolfDirecto");
  }

  // Find SENIOR and FEMENINA category IDs to detect membership
  const seniorCatId = allCategories.find((c) => c.name.toUpperCase().includes("SENIOR"))?.id;
  const femCatId = allCategories.find((c) => c.name.toUpperCase().includes("FEMEN"))?.id;

  // Fetch senior player licenses for cross-reference
  const seniorLicenses = new Set<string>();
  if (seniorCatId) {
    try {
      const seniorRes = await fetch(
        `https://www.golfdirecto.com/web/home/score/ranking/entry?game=${gameId}&category=${seniorCatId}`,
        { headers: { Accept: "application/json" } }
      );
      if (seniorRes.ok) {
        const seniorData = await seniorRes.json();
        for (const entry of (seniorData.data || [])) {
          const lic = entry.player?.license;
          if (lic) seniorLicenses.add(lic);
        }
      }
    } catch { /* ignore */ }
  }

  // Fetch ranking for selected category
  const rankRes = await fetch(
    `https://www.golfdirecto.com/web/home/score/ranking/entry?game=${gameId}&category=${categoryId}`,
    { headers: { Accept: "application/json" } }
  );
  if (!rankRes.ok) throw new Error(`Error obtenint ranking GolfDirecto: ${rankRes.status}`);
  const rankData = await rankRes.json();
  const entries = rankData.data || [];

  const selectedCat = allCategories.find((c) => c.id === categoryId);
  const isNet = selectedCat?.name?.toUpperCase().includes("SCRATCH") === false;

  interface EntryData {
    playerId: string;
    result: ParsedResult;
    apiOnlyGross: number | null;
    apiOnlyNet: number | null;
    apiStrokeNumber: number | null;
    hcpGame: number | null;
  }
  const entryDataList: EntryData[] = [];

  for (const entry of entries) {
    const player = entry.player || {};
    const view = entry.view || {};
    const dayView = view.day || view.acc || {};

    // Format: "APELLIDOS, NOMBRE" (federation standard) for consistent alphabetical sorting
    const surname = (player.surname || "").trim();
    const firstName = (player.firstName || "").trim();
    const name = surname && firstName
      ? `${surname}, ${firstName}`
      : (surname || firstName);
    if (!name || name.length < 2) continue;

    const positionValue = parseNumber(dayView.rankingPosition ?? dayView.realRanking);
    const hcpExact = parseNumber(player.hcpExact);
    const hcpGame = parseNumber(player.hcpGame);
    const apiOnlyGross = parseNumber(dayView.onlyGross);
    const apiOnlyNet = parseNumber(dayView.onlyNet);
    const apiStroke = parseNumber(dayView.strokeNumber);
    // Initial guess — may be overwritten after mode detection.
    const stablefordPoints = parseNumber(dayView.onlyNet ?? (isNet ? dayView.result : null));
    const scratchScore = parseNumber(dayView.strokeNumber ?? dayView.onlyGross ?? (!isNet ? dayView.result : null));

    const license = player.license || "";
    const isSenior = seniorLicenses.has(license);

    const status = detectStatus(
      entry.status, player.status,
      dayView.flag, dayView.flags, dayView.status, dayView.code, dayView.text,
      dayView.observations, dayView.observation, dayView.observaciones,
      dayView.result, dayView.rankingPosition, dayView.realRanking,
      entry.flag, entry.observations,
    );
    const rawStb = stablefordPoints;

    entryDataList.push({
      playerId: player._id || "",
      apiOnlyGross,
      apiOnlyNet,
      apiStrokeNumber: apiStroke,
      hcpGame,
      result: {
        position: positionValue != null ? Math.trunc(positionValue) : 0,
        name,
        license,
        gender: player.gender === "F" ? "F" : player.gender === "M" ? "M" : "",
        handicap: hcpExact,
        handicap_play: hcpGame != null ? Math.trunc(hcpGame) : null,
        stableford_points: status === "completed" ? stablefordPoints : (status === "retired" ? 0 : null),
        scratch_score: status === "completed" ? scratchScore : null,
        scores: [],
        source_url: url,
        play_date: gameDate,
        category: selectedCat?.name ?? null,
        result_status: status,
        raw_stableford_points: status === "retired" ? rawStb : null,
        _is_senior: isSenior,
      },
    });
  }



  // Fetch hole-by-hole scorecards in parallel (batches of 10)
  let coursePar: number[] | undefined;
  let courseHandicap: number[] | undefined;
  let courseHandicapWomen: number[] | undefined;
  const batchSize = 40;
  for (let i = 0; i < entryDataList.length; i += batchSize) {
    const batch = entryDataList.slice(i, i + batchSize);
    const scorecardPromises = batch.map(async (ed) => {
      if (!ed.playerId) return;
      try {
        const cardRes = await fetch(
          `https://www.golfdirecto.com/web/home/score/player/${ed.playerId}/result?game=${gameId}`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
        );
        if (!cardRes.ok) return;
        const cardData = await cardRes.json();
        const data = cardData.data || cardData;
        const score = data.score || {};
        const gameTee = data.gameTee || {};

        const holes: number[] = [];
        for (let h = 1; h <= 18; h++) {
          const val = score[`gross${h}`];
          if (val != null) holes.push(Number(val));
          else holes.push(0);
        }
        const hasData = holes.some((v) => v > 0);
        if (hasData) {
          ed.result.scores = holes;
          // If any hole is 0 (ball picked up), scratch is invalid
          const hasLiftedBall = holes.some((v) => v === 0);
          if (hasLiftedBall) {
            ed.result.scratch_score = null;
          }
        }

        // Extract course par + stroke-index per hole from gameTee
        const readArr = (prefix: string): number[] | null => {
          const arr: number[] = [];
          for (let h = 1; h <= 18; h++) {
            const v = gameTee[`${prefix}${h}`];
            const n = v != null ? Number(v) : NaN;
            if (!Number.isFinite(n) || n <= 0) return null;
            arr.push(n);
          }
          return arr;
        };

        const isFemale = (gameTee.gender || "").toUpperCase() === "F"
          || (ed.result.gender || "").toUpperCase() === "F";

        if (!coursePar) {
          const p = readArr("par");
          if (p) coursePar = p;
        }
        if (!isFemale && !courseHandicap) {
          const h = readArr("hcp");
          if (h) courseHandicap = h;
        }
        if (isFemale && !courseHandicapWomen) {
          const h = readArr("hcp");
          if (h) courseHandicapWomen = h;
        }
      } catch {
        // silently skip scorecard errors
      }
    });
    await Promise.all(scorecardPromises);
  }

  // ── Mode detection + Stableford recomputation ────────────────────────────
  // GolfDirecto sometimes serves SCRATCH categories as stroke-play / relative-to-par
  // instead of as gross-stableford points. We detect this by checking whether the API
  // `onlyGross` value matches `strokeNumber - parTotal` (i.e. it represents strokes
  // over par, not stableford points). When it does, the `onlyNet` value is also
  // relative-to-par and we must recompute net stableford ourselves from the scorecard.

  const parTotal = coursePar ? coursePar.reduce((a, b) => a + b, 0) : 0;
  let computationMode: ComputationMode = "stableford_points";
  let requiresSplit = false;
  const missing: Set<string> = new Set();
  let computationNote: string | null = null;

  // Heuristic: Stableford net is always ≥0 and typically 18–45. Stroke-play / relative-to-par
  // produces values that can be negative or low single digits. Strongest signal: any negative
  // onlyNet ⇒ stroke mode. Fallback: median onlyNet < 15 ⇒ stroke mode.
  const completedEntries = entryDataList.filter((e) => e.result.result_status === "completed");
  const onlyNetVals = completedEntries
    .map((e) => e.apiOnlyNet)
    .filter((v): v is number => v != null);
  const hasNegative = onlyNetVals.some((v) => v < 0);
  let median = 0;
  if (onlyNetVals.length > 0) {
    const sorted = [...onlyNetVals].sort((a, b) => a - b);
    median = sorted[Math.floor(sorted.length / 2)];
  }
  if (hasNegative || (onlyNetVals.length > 0 && median < 15)) {
    computationMode = "strokes";
  }
  

  if (computationMode === "strokes" && parTotal === 0) {
    missing.add("par");
  }



  if (computationMode === "strokes") {
    // Need par + handicap (stroke index) to compute net stableford.
    if (!coursePar) missing.add("par");
    const anyFemale = entryDataList.some((e) => (e.result.gender || "").toUpperCase() === "F");
    if (!courseHandicap && !anyFemale) missing.add("stroke_index");
    if (anyFemale && !courseHandicapWomen && !courseHandicap) missing.add("stroke_index_women");

    if (coursePar && (courseHandicap || courseHandicapWomen)) {
      // Compute net stableford per entry.
      let computedCount = 0;
      let skippedNoHcp = 0;
      let skippedNoScores = 0;
      for (const ed of entryDataList) {
        if (ed.result.result_status !== "completed") continue;
        const scores = ed.result.scores;
        if (!Array.isArray(scores) || scores.length !== 18 || !scores.some((s) => s > 0)) {
          skippedNoScores++;
          continue;
        }
        const hpu = ed.hcpGame;
        if (hpu == null) {
          skippedNoHcp++;
          continue;
        }
        const isFemale = (ed.result.gender || "").toUpperCase() === "F";
        const sIndex = (isFemale && courseHandicapWomen) ? courseHandicapWomen : courseHandicap;
        if (!sIndex) {
          skippedNoHcp++;
          continue;
        }
        // Compute strokes-received per hole from HPU + stroke index.
        const hpuInt = Math.max(0, Math.round(hpu));
        const base = Math.floor(hpuInt / 18);
        const extra = hpuInt % 18;
        const sr: number[] = sIndex.map((idx) => base + (idx <= extra ? 1 : 0));
        let total = 0;
        for (let i = 0; i < 18; i++) {
          const strokes = scores[i];
          if (!strokes || strokes <= 0) continue; // picked-up ball → 0 points
          const par = coursePar[i];
          const pts = Math.max(0, par + sr[i] + 2 - strokes);
          total += pts;
        }
        ed.result.stableford_points = total;
        ed.result._stableford_computed = true;
        computedCount++;
      }
      computationNote = `Mode 'golpes' detectat: ${computedCount} resultats recalculats des de la tarjeta.`;
      if (skippedNoHcp || skippedNoScores) {
        const parts: string[] = [];
        if (skippedNoHcp) parts.push(`${skippedNoHcp} sense HPU/stroke index`);
        if (skippedNoScores) parts.push(`${skippedNoScores} sense tarjeta hoyo a hoyo`);
        computationNote += ` ${parts.join(', ')}.`;
        if (skippedNoHcp > 0 || skippedNoScores > 0) {
          // Some entries could not be computed → require split-category fallback.
          requiresSplit = true;
          if (skippedNoHcp) missing.add("HPU");
          if (skippedNoScores) missing.add("golpes_por_hoyo");
        }
      }
    } else {
      requiresSplit = true;
      computationNote =
        "No es pot calcular Stableford net des d'aquest enllaç perquè falten dades del camp. " +
        "Puja els enllaços de Handicap Inferior i Handicap Superior — aquestes categories tornen els punts oficials.";
    }
  } else if (computationMode === "unknown") {
    requiresSplit = true;
    computationNote =
      "Format desconegut: puja els enllaços de Handicap Inferior i Handicap Superior.";
  }

  const results = entryDataList.map((ed) => ed.result);
  results.sort((a, b) => a.position - b.position);

  return {
    results,
    categories: allCategories,
    course_par: coursePar,
    course_handicap: courseHandicap,
    course_handicap_women: courseHandicapWomen,
    game_date: gameDate,
    computation_mode: computationMode,
    requires_split_categories: requiresSplit,
    missing_fields: Array.from(missing),
    computation_note: computationNote,
  };
}


// ─── TEEONE ────────────────────────────────────────────────────────────────────

async function parseTeeoneViaAPI(url: string, format?: string): Promise<ParsedResult[]> {
  const pageResponse = await fetch(url);
  if (!pageResponse.ok) throw new Error(`Failed to fetch Teeone page: ${pageResponse.status}`);
  const html = await pageResponse.text();

  const getHidden = (name: string): string => {
    const match = html.match(new RegExp(`${name}"\\s*value="([^"]*)"`));
    return match ? match[1] : "";
  };

  const apiDomain = getHidden("HidAPIDominio");
  const token = getHidden("HidTokenAPI");
  const idInicioSesion = getHidden("HidInicioSesion");
  const idVendedor = getHidden("HidVendedor");
  const codTorneo = getHidden("HidTorneo");
  const culture = getHidden("HidCultura") || "es-ES";

  if (!apiDomain || !token || !codTorneo) {
    throw new Error("No s'han pogut extreure els paràmetres de l'API de Teeone. Comprova la URL.");
  }

  const vueltasRes = await fetch(`${apiDomain}/api/LiveScoring/ObtenerVueltasLive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ culture, token, idInicioSesion, idVendedor, codTorneo }),
  });
  const vueltasData = await vueltasRes.json();
  const vueltas: number[] = vueltasData.cod === 1 ? vueltasData.listaVueltas : [1];
  const lastVuelta = vueltas[vueltas.length - 1] || 1;

  const isStableford = !format || format === "stableford";
  const idTipoClasificacion = isStableford ? "4" : "1";

  const classRes = await fetch(`${apiDomain}/api/LiveScoring/ObtenerPosicionesClasificacionLive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      culture, token, idInicioSesion, idVendedor, codTorneo,
      numVuelta: String(lastVuelta),
      idTipoClasificacion,
      codSexo: "T", hcpDesde: "-10", hcpHasta: "54",
      hcpDesempate: false, codNivel: "T",
    }),
  });

  const classData = await classRes.json();
  if (classData.cod !== 1 || !classData.listaPosiciones) {
    throw new Error(classData.msg || "Error obtenint classificació de Teeone");
  }

  const results: ParsedResult[] = [];
  for (const p of classData.listaPosiciones) {
    const pos = parseInt(p.pos) || p.posReal || 0;
    if (!p.nombre || p.nombre.trim().length < 2) continue;

    const scores: number[] = [];
    if (p.r1 && parseInt(p.r1) > 0) scores.push(parseInt(p.r1));
    if (p.r2 && parseInt(p.r2) > 0) scores.push(parseInt(p.r2));
    if (p.r3 && parseInt(p.r3) > 0) scores.push(parseInt(p.r3));
    if (p.r4 && parseInt(p.r4) > 0) scores.push(parseInt(p.r4));

    const total = parseInt(p.tot) || null;
    const handicap = p.hex ? parseFloat(String(p.hex).replace(",", ".")) : null;

    results.push({
      position: pos,
      name: p.nombre.trim(),
      license: p.licencia || "",
      gender: p.codSexo === "F" ? "F" : p.codSexo === "M" ? "M" : "",
      handicap: isNaN(handicap as number) ? null : handicap,
      handicap_play: null,
      stableford_points: isStableford ? total : null,
      scratch_score: !isStableford ? total : null,
      scores,
      source_url: url,
    });
  }

  return results;
}

// ─── GENERIC TABLE ─────────────────────────────────────────────────────────────

function parseGenericTable(html: string, sourceUrl: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let bestTable = "";
  let bestScore = 0;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(clean)) !== null) {
    const content = tableMatch[1].toLowerCase();
    let score = 0;
    if (content.includes("jugador") || content.includes("player") || content.includes("nombre")) score += 5;
    if (content.includes("stableford") || content.includes("puntos")) score += 3;
    if (content.includes("handicap") || content.includes("hcp")) score += 3;
    if (content.includes("pos")) score += 2;
    const rowCount = (content.match(/<tr/g) || []).length;
    score += Math.min(rowCount, 10);
    if (score > bestScore) { bestScore = score; bestTable = tableMatch[1]; }
  }

  if (!bestTable) return results;

  const headerMatch = bestTable.match(/<thead>([\s\S]*?)<\/thead>/i) ||
    bestTable.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!headerMatch) return results;

  const headers: string[] = [];
  const thRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  let th;
  while ((th = thRegex.exec(headerMatch[1])) !== null) {
    headers.push(stripHtml(th[1]).trim().toLowerCase());
  }

  const nameIdx = headers.findIndex(h =>
    h.includes("jugador") || h.includes("nombre") || h.includes("player") || h.includes("nom")
  );
  const ptsIdx = headers.findIndex(h =>
    h.includes("stableford") || h.includes("puntos") || h.includes("pts") || h.includes("points")
  );
  const hcpIdx = headers.findIndex(h =>
    h.includes("hcp") || h.includes("handicap") || h.includes("hex")
  );

  if (nameIdx < 0) return results;

  const allRows = bestTable.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  let posCounter = 0;

  for (let i = 1; i < allRows.length; i++) {
    const cells: string[] = [];
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cell;
    while ((cell = cellRegex.exec(allRows[i])) !== null) {
      cells.push(cell[1]);
    }
    if (cells.length < 2) continue;

    const name = stripHtml(cells[nameIdx]).trim();
    if (!name || name.length < 2) continue;

    posCounter++;
    const ptsText = ptsIdx >= 0 && ptsIdx < cells.length ? stripHtml(cells[ptsIdx]).trim() : "";
    const hcpText = hcpIdx >= 0 && hcpIdx < cells.length ? stripHtml(cells[hcpIdx]).trim() : "";

    results.push({
      position: posCounter,
      name,
      license: "",
      gender: "",
      handicap: hcpText ? parseFloat(hcpText.replace(",", ".")) : null,
      handicap_play: null,
      stableford_points: ptsText ? parseInt(ptsText) : null,
      scratch_score: null,
      scores: [],
      source_url: sourceUrl,
    });
  }

  return results;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}
