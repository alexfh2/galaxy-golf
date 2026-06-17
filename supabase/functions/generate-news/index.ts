import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: require admin role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;
    const { data: isAdmin } = await supabaseAuth.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { round_id, language, tone, sponsor, special_mention, weather_conditions } = await req.json();

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch round data
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", round_id)
      .single();
    if (roundError) throw roundError;

    // Fetch results with player info
    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select("*, players(*)")
      .eq("round_id", round_id)
      .order("stableford_points", { ascending: false });
    if (resultsError) throw resultsError;

    // Fetch season
    const { data: season } = await supabase
      .from("seasons")
      .select("year")
      .eq("id", round.season_id)
      .single();

    // Fetch competition context (Circuito GalaxyGolf / GalaxyCup + stage)
    const { data: roundComps } = await supabase
      .from("round_competitions")
      .select("stage, competition:competitions(slug, name)")
      .eq("round_id", round_id);

    const competitionsCtx = (roundComps ?? []).map((rc: any) => {
      const slug = rc.competition?.slug ?? "";
      const name = rc.competition?.name ?? slug;
      const stage = rc.stage ?? "regular";
      const stageLabel =
        stage === "major" ? "Major" :
        stage === "playoff" ? "Playoff" :
        stage === "final" ? "Gran Final" : "Regular";
      return { slug, name, stage, stageLabel, label: `${name} · ${stageLabel}` };
    });
    const competitionLine = competitionsCtx.length
      ? competitionsCtx.map((c) => c.label).join(" / ")
      : "GalaxyGolf";
    const hasMajor = competitionsCtx.some((c) => c.stage === "major");
    const hasFinal = competitionsCtx.some((c) => c.stage === "final" || c.stage === "playoff");
    const isCircuito = competitionsCtx.some((c) => c.slug === "circuito-galaxygolf");
    const isGalaxyCup = competitionsCtx.some((c) => c.slug === "galaxycup");
    const eventToneHint = hasFinal
      ? "Es una prueba de Playoff/Gran Final: tono épico, decisivo, cierre de temporada."
      : hasMajor
        ? "Es una prueba Major: jornada de máxima categoría, redobla la importancia."
        : "Jornada regular del circuito: tono cercano, deportivo y celebrativo.";

    // Build context for AI — Stableford only (no scratch)
    const topStableford = results.slice(0, 5);
    
    // Categorize results
    const hcpLow = results.filter((r: any) => r.category === 'hcp_low' || (r.handicap_at_round !== null && r.handicap_at_round <= 15.4));
    const hcpHigh = results.filter((r: any) => r.category === 'hcp_high' || (r.handicap_at_round !== null && r.handicap_at_round >= 15.5));
    const females = results.filter((r: any) => r.is_female_prize || r.players?.gender === 'F');

    // Sort each category by stableford
    hcpLow.sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    hcpHigh.sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    females.sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));

    // Check for notable scorecards
    const coursePar = round.course_par as number[] | null;
    let notablePerformances = '';
    if (coursePar && Array.isArray(coursePar)) {
      results.forEach((r: any) => {
        if (r.scorecard && Array.isArray(r.scorecard)) {
          const birdies = r.scorecard.filter((s: number, i: number) => s < coursePar[i]).length;
          if (birdies >= 3) {
            notablePerformances += `${r.players?.name}: ${birdies} birdies. `;
          }
        }
      });
    }

    const langLabel = language === 'ca' ? 'català' : 'castellà';
    const toneLabel = tone === 'press' 
      ? 'nota de premsa esportiva, formal i professional' 
      : 'engrescador per xarxes socials (WhatsApp/Instagram), amb emojis i to proper';


    const prompt = `Genera una notícia esportiva de golf en ${langLabel} amb to de ${toneLabel}.

CONTEXT DE MARCA — GalaxyGolf:
- GalaxyGolf organitza dos circuits aquesta temporada: "Circuito GalaxyGolf" (els millors camps de Catalunya) i "GalaxyCup" (proves de divendres, dissabte i diumenge, individual o per parelles).
- Aquesta jornada compta per a: ${competitionLine}.
- ${eventToneHint}
- ${isCircuito ? "Quan parlis del Circuito GalaxyGolf, recorda el caràcter de circuit que recorre els millors camps i premia la regularitat." : ""}
- ${isGalaxyCup ? "Quan parlis de la GalaxyCup, destaca la proximitat i el format flexible (cap de setmana, individual o parelles)." : ""}

ESTIL DE REDACCIÓ GALAXYGOLF (referència real del blog/Facebook):
- Proper, càlid i directe, com parlant amb els jugadors del circuit ("els nostres jugadors", "el nostre circuit").
- Frases curtes, energia positiva, sense floritures literàries.
- Convidatori: recorda subtilment que poden seguir el circuit o inscriure's a futures jornades.
- Modalitat STABLEFORD. NO mencionis cops scratch ni cops totals.

TEXT DE REFERÈNCIA D'ESTRUCTURA (adapta a Stableford i a GalaxyGolf):
---
Després de [X] intenses jornades, la classificació es va consolidant i ja es perfilen els jugadors que lluitaran pel podi.

Hándicap Inferior — la batalla dels millors:
1. [Nom] encapçala amb [X] pts, mostrant una regularitat impressionant.
2. Molt a prop, [Nom] amb [X] pts.
3. La tercera posició és per a [Nom] amb [X] pts.

Hándicap Superior — els qui millor dominen el camp:
[Mateixa estructura]

Classificació Femenina:
[Guanyadora]

[Si hi ha actuacions destacades: birdies, etc.]

Per a més detalls visiteu la nostra web.
---

DADES DE LA JORNADA:
- Jornada: ${round.name} (J${round.round_number})
- Competició: ${competitionLine}
- Temporada: ${season?.year || 'N/A'}
- Club: ${round.club || 'N/A'}
- Camp: ${round.course || 'N/A'}
- Data: ${round.date}
- Patrocinador: ${sponsor || 'cap'}

${special_mention ? `- Menció especial: ${special_mention}` : ''}
${(() => {
  const w = weather_conditions || {};
  const lines: string[] = [];
  if (w.friday) lines.push(`  · Divendres: ${w.friday}`);
  if (w.saturday) lines.push(`  · Dissabte: ${w.saturday}`);
  if (w.sunday) lines.push(`  · Diumenge: ${w.sunday}`);
  if (w.green_speed) lines.push(`  · Velocitat dels greens: ${w.green_speed}`);
  if (w.wind) lines.push(`  · Vent: ${w.wind}`);
  return lines.length ? `- Condicions meteorològiques i del camp:\n${lines.join('\n')}` : '';
})()}

CLASSIFICACIÓ HÁNDICAP INFERIOR (≤15,4) — ${hcpLow.length} jugadors:
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join('\n')}

CLASSIFICACIÓ HÁNDICAP SUPERIOR (≥15,5) — ${hcpHigh.length} jugadors:
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join('\n')}

${females.length > 0 ? `CLASSIFICACIÓ FEMENINA — ${females.length} jugadores:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ''}

${notablePerformances ? `ACTUACIONS DESTACADES: ${notablePerformances}` : ''}

Total participants: ${results.length}

INSTRUCCIONS:
- ABSOLUTAMENT CAP EMOJI. Ni un sol emoji en tot el text.
- Veu de marca GalaxyGolf: propera, directa, càlida, sense pomposa retòrica.
- Inclou sempre el nom de la competició (${competitionLine}) a la introducció.
- ${hasMajor ? "Subratlla que és una prova MAJOR del circuit." : ""}
- ${hasFinal ? "Aquesta és la Gran Final / Playoff: destaca el desenllaç de temporada i els campions." : ""}
- Estructura: introducció breu, després cada categoria amb top 3 (Hcp Baix i Alt) o guanyador/a (Femenina i Sènior).
- OBLIGATORI: inclou SEMPRE les 4 categories si hi ha dades.
- Separa cada secció amb una línia en blanc.
- NO mencionis resultats scratch ni cops totals.
- Si s'han proporcionat condicions del camp/meteorologia, integra-les amb naturalitat si són rellevants.
- Genera un títol atractiu (sense emojis), un subtítol, un cos complet, 3-5 highlights curts i un extracte SEO ≤160 caràcters.

Retorna EXCLUSIVAMENT un JSON vàlid amb aquest format:
{
  "title": "...",
  "subtitle": "...",
  "body": "...",
  "highlights": ["...", "..."],
  "seo_excerpt": "..."
}`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Ets un redactor esportiu especialitzat en golf. Respon SEMPRE amb JSON vàlid, sense markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle potential markdown wrapping)
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const news = JSON.parse(cleaned);

    return new Response(JSON.stringify({ success: true, news }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
