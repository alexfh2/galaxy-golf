/**
 * Calcula los puntos Stableford SCRATCH (sin handicap) de una tarjeta.
 * Fórmula: por hoyo, max(0, 2 - (golpes - par)). Hoyos sin golpes (0/null) se omiten.
 * Si los golpes son 0/null (bola levantada) → no suma.
 */
export function computeScratchStableford(scorecard: any, coursePar: any): number | null {
  const scores: (number | null)[] | null = Array.isArray(scorecard)
    ? scorecard
    : Array.isArray(scorecard?.scores)
    ? scorecard.scores
    : null;
  const pars: number[] | null = Array.isArray(coursePar) ? coursePar : null;
  if (!scores || !pars || scores.length !== pars.length) return null;
  let total = 0;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (s == null || s === 0) continue;
    total += Math.max(0, 2 - (s - pars[i]));
  }
  return total;
}

// ============================================================
// Handicap stableford (same rules as ScorecardVisual)
// ============================================================

const calcPlayingHcp = (hcp: number): number => Math.round(hcp);

const calcExtraStrokes = (strokeIndex: number, playerHcp: number): number => {
  const playingHcp = calcPlayingHcp(playerHcp);
  if (playingHcp === 0) return 0;
  if (playingHcp > 0) {
    const fullStrokes = Math.floor(playingHcp / 18);
    const remainder = playingHcp % 18;
    return fullStrokes + (strokeIndex <= remainder ? 1 : 0);
  }
  const abs = -playingHcp;
  const fullStrokes = Math.floor(abs / 18);
  const remainder = abs % 18;
  return -(fullStrokes + (strokeIndex > 18 - remainder ? 1 : 0));
};

const calcHoleStableford = (
  gross: number | null | undefined,
  holePar: number,
  strokeIndex: number,
  playerHcp: number
): number | null => {
  if (gross == null || gross === 0) return null;
  const net = gross - calcExtraStrokes(strokeIndex, playerHcp);
  const diff = net - holePar;
  if (diff <= -3) return 5;
  if (diff === -2) return 4;
  if (diff === -1) return 3;
  if (diff === 0) return 2;
  if (diff === 1) return 1;
  return 0;
};

/**
 * Calcula puntos Stableford CON handicap usando los stroke index del campo.
 * Devuelve null si faltan datos (par/hcp del campo o handicap del jugador).
 */
export function computeHandicapStableford(
  scorecard: any,
  coursePar: any,
  courseHcp: any,
  playerHandicap: number | null | undefined
): number | null {
  const scores: (number | null)[] | null = Array.isArray(scorecard)
    ? scorecard
    : Array.isArray(scorecard?.scores)
    ? scorecard.scores
    : null;
  const pars: number[] | null = Array.isArray(coursePar) ? coursePar : null;
  const hcps: number[] | null = Array.isArray(courseHcp) ? courseHcp : null;
  if (
    !scores ||
    !pars ||
    !hcps ||
    pars.length !== 18 ||
    hcps.length !== 18 ||
    scores.length !== 18 ||
    playerHandicap == null
  ) {
    return null;
  }
  let total = 0;
  for (let i = 0; i < 18; i++) {
    const pts = calcHoleStableford(scores[i], pars[i], hcps[i], playerHandicap);
    if (pts != null) total += pts;
  }
  return total;
}
