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

    const { round_id, language } = await req.json();

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", round_id)
      .single();
    if (roundError) throw roundError;

    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select("*, players(*)")
      .eq("round_id", round_id)
      .order("stableford_points", { ascending: false });
    if (resultsError) throw resultsError;

    const { data: season } = await supabase
      .from("seasons")
      .select("year")
      .eq("id", round.season_id)
      .single();

    // Competition context
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
      return { slug, name, stage, label: `${name} · ${stageLabel}` };
    });
    const competitionLine = competitionsCtx.length
      ? competitionsCtx.map((c) => c.label).join(" / ")
      : "GalaxyGolf";
    const hasMajor = competitionsCtx.some((c) => c.stage === "major");
    const hasFinal = competitionsCtx.some((c) => c.stage === "final" || c.stage === "playoff");
    const isCircuito = competitionsCtx.some((c) => c.slug === "circuito-galaxygolf");
    const isGalaxyCup = competitionsCtx.some((c) => c.slug === "galaxycup");

    // Categorize results
    const hcpLow = results
      .filter((r: any) => r.category === "hcp_low" || (r.handicap_at_round !== null && r.handicap_at_round <= 15.4))
      .sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const hcpHigh = results
      .filter((r: any) => r.category === "hcp_high" || (r.handicap_at_round !== null && r.handicap_at_round >= 15.5))
      .sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const females = results
      .filter((r: any) => r.is_female_prize || r.players?.gender === 'F')
      .sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));

    // Notable performances (birdies)
    const coursePar = round.course_par as number[] | null;
    let notablePerformances = "";
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

    const langLabel = language === "ca" ? "català" : "castellà";

    const competitionHashtags = [
      "#GalaxyGolf",
      isCircuito ? "#CircuitoGalaxyGolf" : "",
      isGalaxyCup ? "#GalaxyCup" : "",
      hasMajor ? "#Major" : "",
      hasFinal ? "#GranFinal" : "",
    ].filter(Boolean).join(" ");

    const prompt = `Genera un post d'Instagram en ${langLabel} per compartir els RESULTATS d'una jornada de GalaxyGolf.

CONTEXT DE MARCA — GalaxyGolf:
- Compta per a: ${competitionLine}.
- ${hasFinal ? "Prova de Playoff/Gran Final: tono èpic i celebratori." : hasMajor ? "Prova MAJOR del circuit: jornada destacada." : "Jornada regular del circuit."}
- ${isCircuito ? "Circuito GalaxyGolf: els millors camps de Catalunya, regularitat i premi al final de temporada." : ""}
- ${isGalaxyCup ? "GalaxyCup: format flexible cap de setmana, individual o parelles, ambient proper." : ""}
- Veu: propera, càlida, celebrativa. Frases curtes. Emojis amb moderació.

ESTRUCTURA DE REFERÈNCIA (adapta-la per a RESULTATS):
🏌️‍♂️ ${competitionLine}
[Nom de la jornada]
📍 [Camp]
📅 [Data]

[1-2 frases breus i engrescadores sobre com va anar la jornada]

🏆 RESULTATS

*Hándicap Inferior (≤15,4)*
🥇 [Nom] — [Punts] pts
🥈 [Nom] — [Punts] pts
🥉 [Nom] — [Punts] pts

*Hándicap Superior (≥15,5)*
🥇 [Nom] — [Punts] pts
🥈 [Nom] — [Punts] pts
🥉 [Nom] — [Punts] pts

*Femenina*
🥇 [Nom] — [Punts] pts

*Femenina*
🥇 [Nom] — [Punts] pts

[Si hi ha actuacions destacades com birdies, menciona-les breument]

[Frase de tancament: convida a la propera jornada o a inscriure's al circuit]

${competitionHashtags}

DADES DE LA JORNADA:
- Jornada: ${round.name} (J${round.round_number})
- Competició: ${competitionLine}
- Temporada: ${season?.year || "N/A"}
- Club: ${round.club || "N/A"}
- Camp: ${round.course || "N/A"}
- Data: ${round.date}
- Patrocinador: ${round.sponsor || "cap"}

CLASSIFICACIÓ HÁNDICAP INFERIOR (≤15,4):
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

CLASSIFICACIÓ HÁNDICAP SUPERIOR (≥15,5):
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

${females.length > 0 ? `CLASSIFICACIÓ FEMENINA — Guanyadora:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ""}

${notablePerformances ? `ACTUACIONS DESTACADES: ${notablePerformances}` : ""}

Total participants: ${results.length}

INSTRUCCIONS:
- Comença el post mencionant la competició (${competitionLine}).
- Per a Hándicap Inferior i Superior: top 3 amb 🥇🥈🥉.
- Per a Femenina i Sènior: només guanyador/a (🥇).
- Línia en blanc entre seccions.
- Inclou SEMPRE els hashtags GalaxyGolf al final: ${competitionHashtags}
- Si hi ha patrocinador, menciona'l de forma natural.
- Tono celebratori i proper, ${hasFinal ? "amb energia de cierre de temporada" : hasMajor ? "remarcant la importància del Major" : "convidant a la propera jornada"}.
- Modalitat STABLEFORD. NO mencionis resultats scratch ni cops totals.
- Emojis amb moderació, només els de l'estructura.
- Retorna NOMÉS el text del post, sense JSON ni markdown.`;

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
          { role: "system", content: "Ets un community manager especialitzat en golf i gastronomia. Generes posts d'Instagram atractius i engrescadors amb emojis." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Clean potential markdown wrapping
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "");
    }

    return new Response(JSON.stringify({ success: true, post: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
