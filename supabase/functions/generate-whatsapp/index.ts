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

    const langLabel = language === "ca" ? "català" : "castellà";
    const publishedUrl = "https://galaxygolf.lovable.app/ranquings";

    const prompt = `Genera un missatge de WhatsApp en ${langLabel} per compartir els RESULTATS d'una jornada de GalaxyGolf.

CONTEXT DE MARCA — GalaxyGolf:
- Aquesta jornada compta per a: ${competitionLine}.
- ${hasFinal ? "És una prova de Playoff/Gran Final: tono decisiu i celebratori." : hasMajor ? "És una prova MAJOR: jornada destacada del circuit." : "Jornada regular del circuit."}
- Veu de marca: propera, càlida, directa. Recorda subtilment que poden seguir el circuit a la web.
- Modalitat STABLEFORD. NO mencionis "cops" ni "scratch".

TEXT DE REFERÈNCIA (adapta amb dades reals i estil GalaxyGolf):
---
*Resultats ${round.name}* — ${competitionLine}

El ${round.club || "club"} ha acollit la ${round.name}, disputada el ${round.date} amb ${results.length} jugadors.
${round.sponsor ? `Jornada patrocinada per ${round.sponsor}.` : ""}

*Hándicap Inferior (≤15,4)*
1. [NOM] — [X] pts
2. [NOM] — [X] pts
3. [NOM] — [X] pts

*Hándicap Superior (≥15,5)*
1. [NOM] — [X] pts
2. [NOM] — [X] pts
3. [NOM] — [X] pts
${females.length > 0 ? `\n*Femenina*\n1. [NOM] — [X] pts` : ""}

Classificacions completes: ${publishedUrl}
---

DADES REALS:
CLASSIFICACIÓ HÁNDICAP INFERIOR (≤15,4) — ${hcpLow.length} jugadors:
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

CLASSIFICACIÓ HÁNDICAP SUPERIOR (≥15,5) — ${hcpHigh.length} jugadors:
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

${females.length > 0 ? `CLASSIFICACIÓ FEMENINA — Guanyadora:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ""}

Total participants: ${results.length}

INSTRUCCIONS:
- Segueix l'estructura del text de referència adaptada a GalaxyGolf.
- Comença mencionant la competició: ${competitionLine}.
- ${hasMajor ? "Subratlla que és una prova MAJOR." : ""}
- ${hasFinal ? "Aquesta és la Gran Final/Playoff: tono decisiu." : ""}
- Per a Hándicap Inferior i Superior: top 3. Per a Femenina i Sènior: només guanyador/a.
- Línia en blanc entre seccions.
- Format *negretes* de WhatsApp per al títol i noms de categories.
- To proper i clar, sense emojis excessius (cap o molt pocs).
- SEMPRE punts Stableford, MAI cops ni scratch.
- Inclou el link al final: ${publishedUrl}
- Retorna NOMÉS el text del missatge, sense JSON ni markdown.`;

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
          { role: "system", content: "Ets un redactor esportiu de golf. Generes missatges de WhatsApp clars, formals i concisos." },
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
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "");
    }

    return new Response(JSON.stringify({ success: true, message: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
