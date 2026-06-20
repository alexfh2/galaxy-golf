import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RankingResultRow = {
  id: string;
  round_id: string;
  player_id: string;
  handicap_at_round: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  category: string | null;
  is_female_prize: boolean;
  scorecard: unknown;
  play_date: string | null;
  source_url: string | null;
  result_status: string;
  raw_stableford_points: number | null;
  created_at: string;
  updated_at: string;
  players_public: {
    id: string;
    name: string;
    license: string | null;
    club: string | null;
    gender: string | null;
    initial_handicap: number | null;
    current_handicap: number | null;
    photo_url: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  rounds: {
    status: string;
    name: string;
    round_number: number;
    date: string | null;
    club: string | null;
    course: string | null;
    course_par: unknown;
    course_handicap: unknown;
    course_handicap_women: unknown;
  } | null;
};

type PublicPlayerRow = {
  id: string;
  license: string | null;
  name: string;
  club: string | null;
  current_handicap: number | null;
  initial_handicap: number | null;
  gender: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const fetchAllResults = async () => {
      const pageSize = 1000;
      const all: any[] = [];
      let from = 0;
      // Paginate to bypass PostgREST default 1000-row limit
      // (otherwise full circuit/galaxycup rankings get truncated)
      while (true) {
        const { data, error } = await adminClient
          .from("results")
          .select(`
            id,
            round_id,
            player_id,
            handicap_at_round,
            stableford_points,
            scratch_score,
            category,
            is_female_prize,
            scorecard,
            play_date,
            source_url,
            extra_play_count,
            official_position,
            official_category,
            result_status,
            raw_stableford_points,
            created_at,
            updated_at,
            rounds!inner(status, name, round_number, date, club, course, course_par, course_handicap, course_handicap_women),
            players!inner(id, name, license, club, gender, initial_handicap, current_handicap, photo_url, created_at, updated_at)
          `)
          .eq("rounds.status", "published")
          .in("result_status", ["completed", "retired"])
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) return { data: null, error };
        const batch = data ?? [];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      return { data: all, error: null };
    };

    const [
      { data: resultsData, error: resultsError },
      { data: playersData, error: playersError },
      { data: roundCompsData, error: roundCompsError },
    ] = await Promise.all([
      fetchAllResults(),

      adminClient
        .from("players")
        .select("id, license, name, club, current_handicap, initial_handicap, gender, photo_url, created_at, updated_at")
        .order("name"),
      adminClient
        .from("round_competitions")
        .select("round_id, competition_id, stage, counts_for_ranking, competition_round_number, competitions!inner(id, slug, name, competition_type)"),
    ]);

    if (resultsError) throw resultsError;
    if (playersError) throw playersError;
    if (roundCompsError) throw roundCompsError;

    const results: RankingResultRow[] = (resultsData || []).map((row: any) => ({
      id: row.id,
      round_id: row.round_id,
      player_id: row.player_id,
      handicap_at_round: row.handicap_at_round,
      stableford_points: row.stableford_points,
      scratch_score: row.scratch_score,
      category: row.category,
      is_female_prize: row.is_female_prize,
      scorecard: row.scorecard,
      play_date: row.play_date,
      source_url: row.source_url,
      extra_play_count: row.extra_play_count ?? 0,
      official_position: row.official_position ?? null,
      official_category: row.official_category ?? null,
      result_status: row.result_status ?? 'completed',
      raw_stableford_points: row.raw_stableford_points ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      rounds: row.rounds
        ? {
            status: row.rounds.status,
            name: row.rounds.name,
            round_number: row.rounds.round_number,
            date: row.rounds.date,
            club: row.rounds.club,
            course: row.rounds.course,
            course_par: row.rounds.course_par,
            course_handicap: row.rounds.course_handicap,
            course_handicap_women: row.rounds.course_handicap_women,
          }
        : null,
      players_public: row.players
        ? {
            id: row.players.id,
            name: row.players.name,
            license: row.players.license,
            club: row.players.club,
            gender: row.players.gender,
            initial_handicap: row.players.initial_handicap,
            current_handicap: row.players.current_handicap,
            photo_url: row.players.photo_url,
            created_at: row.players.created_at,
            updated_at: row.players.updated_at,
          }
        : null,
    }));

    // Pre-sign player photo URLs server-side (service role) so the public site
    // can render them without each anon client needing to call storage sign.
    const PHOTO_BUCKET = "photos";
    const SIGN_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days
    const extractPhotoPath = (url: string | null): string | null => {
      if (!url) return null;
      const markers = [
        `/object/public/${PHOTO_BUCKET}/`,
        `/object/sign/${PHOTO_BUCKET}/`,
        `/object/${PHOTO_BUCKET}/`,
      ];
      for (const m of markers) {
        const i = url.indexOf(m);
        if (i !== -1) {
          const rest = url.substring(i + m.length);
          const q = rest.indexOf("?");
          return q === -1 ? rest : rest.substring(0, q);
        }
      }
      return null;
    };
    const signedPhotoCache = new Map<string, string | null>();
    const signPlayerPhoto = async (url: string | null): Promise<string | null> => {
      const path = extractPhotoPath(url);
      if (!path) return url ?? null;
      if (signedPhotoCache.has(path)) return signedPhotoCache.get(path)!;
      const { data, error } = await adminClient.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, SIGN_EXPIRES_IN);
      const signed = !error && data?.signedUrl ? data.signedUrl : null;
      signedPhotoCache.set(path, signed);
      return signed;
    };

    const players: PublicPlayerRow[] = await Promise.all(
      (playersData || []).map(async (player: any) => ({
        id: player.id,
        license: player.license,
        name: player.name,
        club: player.club,
        current_handicap: player.current_handicap,
        initial_handicap: player.initial_handicap,
        gender: player.gender,
        photo_url: await signPlayerPhoto(player.photo_url),
        created_at: player.created_at,
        updated_at: player.updated_at,
      })),
    );

    const round_competitions = (roundCompsData || []).map((row: any) => ({
      round_id: row.round_id,
      competition_id: row.competition_id,
      stage: row.stage,
      counts_for_ranking: row.counts_for_ranking,
      competition_round_number: row.competition_round_number,
      competition: row.competitions
        ? {
            id: row.competitions.id,
            slug: row.competitions.slug,
            name: row.competitions.name,
            competition_type: row.competitions.competition_type,
          }
        : null,
    }));

    return new Response(JSON.stringify({ players, results, round_competitions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});