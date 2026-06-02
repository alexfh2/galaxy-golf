import * as XLSX from 'xlsx';

export type HoleMode = 'strokes' | 'stableford_points';

export interface ExcelParsedResult {
  position: number;
  name: string;
  license: string;
  gender: string;
  age: number | null;
  handicap_exact: number | null;
  handicap_play: number | null;
  category: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  /** Strokes per hole. Empty when mode === 'stableford_points'. */
  scores: (number | null)[];
  /** Stableford points per hole. Empty when mode === 'strokes'. */
  hole_stableford: (number | null)[];
  /** Stableford total as found in the Excel "Total/Stb" column (audit). */
  excel_total_stableford: number | null;
  /** Sum of hole_stableford when mode === 'stableford_points'. */
  computed_total_stableford: number | null;
  is_np: boolean;
  is_senior: boolean;
}


// Normalize header text for matching
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Map of semantic field → possible header names (normalized)
const HEADER_ALIASES: Record<string, string[]> = {
  pos:      ['pos', 'posicion', 'posicio', 'position', 'clas', 'clasificacion'],
  name:     ['nombre', 'nom', 'jugador', 'jugadora', 'player', 'name'],
  license:  ['licencia', 'llicencia', 'lic', 'license', 'nlic', 'nlicencia'],
  hex:      ['hex', 'hexacto', 'handicapexacto', 'hcpexacto', 'hcpex'],
  nvh:      ['nvh', 'hj', 'handicapjuego'],
  niv:      ['niv', 'nivel', 'level', 'senior'],
  age:      ['edad', 'edat', 'age'],
  gender:   ['sex', 'sexo', 'genero', 'genre', 'gen', 'g'],
  category: ['cat', 'categoria', 'category'],
  hpu:      ['hpu', 'hcpjuego', 'handicapjuego', 'hcpu'],
  total:    ['total', 'stableford', 'stb', 'puntos', 'points', 'net'],
  scratch:  ['totalx', 'brt', 'bruto', 'gross', 'scratch', 'totalgolpes'],
  team:     ['equipo', 'equip', 'team'],
};

interface ColumnMap {
  pos: number | null;
  name: number | null;
  license: number | null;
  hex: number | null;
  nvh: number | null;
  niv: number | null;
  age: number | null;
  gender: number | null;
  category: number | null;
  hpu: number | null;
  total: number | null;
  scratch: number | null;
  holeColumns: number[]; // indices for holes 1-18
}

function detectColumns(ws: XLSX.WorkSheet, headerRow: number, range: XLSX.Range): ColumnMap {
  const map: ColumnMap = {
    pos: null, name: null, license: null, hex: null, nvh: null, niv: null,
    age: null, gender: null, category: null, hpu: null, total: null,
    scratch: null, holeColumns: [],
  };

  const headers: { col: number; raw: string; normalized: string }[] = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (!cell || cell.v == null) continue;
    const raw = String(cell.v).trim();
    const normalized = norm(raw);
    headers.push({ col: c, raw, normalized });
  }

  // Match semantic fields
  for (const h of headers) {
    // Check if it's a hole number (1-18)
    // Matches: "1", "01", "H1", "h1", "Hoyo 1", "hoyo1", "Hole 1", etc.
    const holeMatch = h.raw.match(/^(?:h(?:oyo|ole)?\s*)?(\d{1,2})$/i);
    const holeNum = holeMatch ? parseInt(holeMatch[1], 10) : NaN;
    if (!isNaN(holeNum) && holeNum >= 1 && holeNum <= 18) {
      map.holeColumns.push(h.col);
      continue;
    }

    // Match against aliases
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (field === 'team') continue; // skip, we don't need it
      if (aliases.includes(h.normalized)) {
        (map as unknown as Record<string, number | null | number[]>)[field] = h.col;
        break;
      }
    }
  }

  // Sort hole columns by their header number
  map.holeColumns.sort((a, b) => {
    const aCell = ws[XLSX.utils.encode_cell({ r: headerRow, c: a })];
    const bCell = ws[XLSX.utils.encode_cell({ r: headerRow, c: b })];
    const extractNum = (v: string) => {
      const m = v.match(/(\d{1,2})/);
      return m ? parseInt(m[1]) : 0;
    };
    return extractNum(String(aCell?.v || '0')) - extractNum(String(bCell?.v || '0'));
  });

  return map;
}

function findHeaderRow(ws: XLSX.WorkSheet, range: XLSX.Range): number {
  // Look in first 5 rows for a row containing recognizable headers
  for (let r = range.s.r; r <= Math.min(range.s.r + 4, range.e.r); r++) {
    let matchCount = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v == null) continue;
      const n = norm(String(cell.v).trim());
      // Check if this looks like a known header
      for (const aliases of Object.values(HEADER_ALIASES)) {
        if (aliases.includes(n)) { matchCount++; break; }
      }
      // Also count hole numbers
      const raw = String(cell.v);
      const holeMatch = raw.match(/^(?:h(?:oyo|ole)?\s*)?(\d{1,2})$/i);
      const num = holeMatch ? parseInt(holeMatch[1], 10) : NaN;
      if (!isNaN(num) && num >= 1 && num <= 18) matchCount++;
    }
    if (matchCount >= 3) return r;
  }
  return 0; // default to first row
}

export interface ExcelDiagnosticDiscrepancy {
  name: string;
  holes: (number | null)[];
  computed: number;
  excel: number;
  diff: number;
}

export interface ExcelDiagnostics {
  holeColumns: { index: number; name: string }[];
  totalColumn: { index: number; name: string } | null;
  scratchColumn: { index: number; name: string } | null;
  nameColumn: { index: number; name: string } | null;
  playerCount: number;
  withTotalCount: number;
  discrepancyCount: number;
  discrepancyRatio: number;
  massDiscrepancy: boolean;
  discrepancies: ExcelDiagnosticDiscrepancy[];
}

export interface ExcelParseOutput {
  results: ExcelParsedResult[];
  hasSeniorInfo: boolean;
  mode: HoleMode;
  warnings: string[];
  diagnostics: ExcelDiagnostics;
}

export interface ExcelParseOptions {
  holeMode?: HoleMode;
}

export function parseExcelResults(buffer: ArrayBuffer, options?: ExcelParseOptions): ExcelParseOutput {
  const mode: HoleMode = options?.holeMode ?? 'strokes';
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('No s\'ha trobat cap fulla al fitxer Excel');

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const headerRow = findHeaderRow(ws, range);
  const cols = detectColumns(ws, headerRow, range);

  if (!cols.name) {
    throw new Error('No s\'ha trobat la columna de nom al fitxer Excel');
  }

  const results: ExcelParsedResult[] = [];
  const warnings: string[] = [];
  let posCounter = 0;
  // Aggregates for global warnings
  let totalHoleValues = 0;
  let onesCount = 0;
  let highStbCount = 0; // values > 5 in stableford mode
  const discrepancies: ExcelDiagnosticDiscrepancy[] = [];
  let withTotalCount = 0;

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const getVal = (c: number | null) => {
      if (c === null) return null;
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell ? cell.v : null;
    };

    const getNum = (c: number | null): number | null => {
      const v = getVal(c);
      if (v == null || v === '' || v === 'N.P' || v === '-') return null;
      const s = String(v).replace(',', '.');
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    const nameVal = getVal(cols.name!);
    if (!nameVal) continue;
    const name = String(nameVal).trim();
    if (!name) continue;

    const totalRaw = getVal(cols.total);
    const scratchRaw = getVal(cols.scratch);
    const isNP = totalRaw === 'N.P' || totalRaw === 'NP' || scratchRaw === 'N.P' || scratchRaw === 'NP';

    posCounter++;

    if (isNP) {
      results.push({
        position: posCounter,
        name,
        license: String(getVal(cols.license) || ''),
        gender: String(getVal(cols.gender) || ''),
        age: getNum(cols.age) != null ? Math.floor(getNum(cols.age)!) : null,
        handicap_exact: getNum(cols.hex),
        handicap_play: getNum(cols.hpu),
        category: getNum(cols.category) != null ? Math.floor(getNum(cols.category)!) : null,
        stableford_points: null,
        scratch_score: null,
        scores: [],
        hole_stableford: [],
        excel_total_stableford: null,
        computed_total_stableford: null,
        is_np: true,
        is_senior: String(getVal(cols.niv) || '').toUpperCase() === 'S',
      });
      continue;
    }

    const posRaw = getNum(cols.pos);
    const position = posRaw ? Math.floor(posRaw) : posCounter;

    // Parse hole values (could be strokes OR stableford points depending on mode)
    const holeValues: (number | null)[] = [];
    for (const hc of cols.holeColumns) {
      holeValues.push(getNum(hc));
    }
    for (const v of holeValues) {
      if (v == null) continue;
      totalHoleValues++;
      if (v === 1) onesCount++;
      if (mode === 'stableford_points' && v > 5) highStbCount++;
    }

    const excelStableford = getNum(cols.total);
    const excelTotalStableford =
      excelStableford != null ? Math.floor(excelStableford) : null;

    let scores: (number | null)[] = [];
    let holeStableford: (number | null)[] = [];
    let stablefordPoints: number | null = null;
    let scratchScore: number | null = null;
    let computedTotalStableford: number | null = null;

    if (mode === 'stableford_points') {
      // Holes ARE stableford points. Do not infer strokes.
      holeStableford = holeValues;
      const validHoles = holeValues.filter((v) => v != null) as number[];
      if (validHoles.length > 0) {
        computedTotalStableford = validHoles.reduce((s, n) => s + n, 0);
      }
      if (excelTotalStableford != null) {
        withTotalCount++;
        stablefordPoints = excelTotalStableford;
        if (
          computedTotalStableford != null &&
          computedTotalStableford !== excelTotalStableford
        ) {
          discrepancies.push({
            name,
            holes: holeValues,
            excel: excelTotalStableford,
            computed: computedTotalStableford,
            diff: excelTotalStableford - computedTotalStableford,
          });
        }
      } else if (computedTotalStableford != null) {
        stablefordPoints = computedTotalStableford;
      }
      // Scratch / strokes cannot be derived from stableford points alone.
      scratchScore = null;
    } else {
      // Default: holes are strokes (existing behaviour)
      scores = holeValues;
      const hasLiftedBall = scores.length > 0 && scores.some((s) => s === null);
      stablefordPoints = excelTotalStableford;
      const rawScratch = getNum(cols.scratch);
      scratchScore = hasLiftedBall
        ? null
        : rawScratch != null
        ? Math.floor(rawScratch)
        : null;
    }

    results.push({
      position,
      name,
      license: String(getVal(cols.license) || ''),
      gender: String(getVal(cols.gender) || ''),
      age: getNum(cols.age) != null ? Math.floor(getNum(cols.age)!) : null,
      handicap_exact: getNum(cols.hex),
      handicap_play: getNum(cols.hpu),
      category: getNum(cols.category) != null ? Math.floor(getNum(cols.category)!) : null,
      stableford_points: stablefordPoints,
      scratch_score: scratchScore,
      scores,
      hole_stableford: holeStableford,
      excel_total_stableford: excelTotalStableford,
      computed_total_stableford: computedTotalStableford,
      is_np: false,
      is_senior: String(getVal(cols.niv) || '').toUpperCase() === 'S',
    });
  }

  // Format-detection warnings
  if (mode === 'stableford_points') {
    if (highStbCount > 0) {
      warnings.push(
        `Hi ha ${highStbCount} valors per forat superiors a 5. Revisa si el format seleccionat és correcte (punts Stableford normalment són 0-5).`,
      );
    }
    if (discrepancies.length > 0) {
      const preview = discrepancies
        .slice(0, 5)
        .map((d) => `${d.name}: Excel ${d.excel} vs suma ${d.computed}`)
        .join(' · ');
      warnings.push(
        `${discrepancies.length} jugadors amb total Stableford diferent al sumatori dels forats. ${preview}`,
      );
    }
    warnings.push(
      'Mode Stableford per forat: no es calcularan birdies, eagles ni scratch oficial (no hi ha cops reals).',
    );
  } else {
    // strokes mode: if many holes are "1", likely the file is actually stableford
    if (totalHoleValues >= 18 && onesCount / totalHoleValues >= 0.2) {
      warnings.push(
        `Aquest Excel conté molts valors 1 per forat (${onesCount}/${totalHoleValues}). És possible que les columnes siguin punts Stableford i no cops. Canvia el format si cal.`,
      );
    }
  }

  const hasSeniorInfo = cols.age !== null || cols.niv !== null;

  const headerName = (c: number | null): string => {
    if (c == null) return '';
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    return cell?.v != null ? String(cell.v).trim() : '';
  };

  const playerCount = results.filter((r) => !r.is_np).length;
  const discrepancyRatio =
    withTotalCount > 0 ? discrepancies.length / withTotalCount : 0;

  const diagnostics: ExcelDiagnostics = {
    holeColumns: cols.holeColumns.map((c) => ({ index: c, name: headerName(c) })),
    totalColumn: cols.total != null ? { index: cols.total, name: headerName(cols.total) } : null,
    scratchColumn: cols.scratch != null ? { index: cols.scratch, name: headerName(cols.scratch) } : null,
    nameColumn: cols.name != null ? { index: cols.name, name: headerName(cols.name) } : null,
    playerCount,
    withTotalCount,
    discrepancyCount: discrepancies.length,
    discrepancyRatio,
    massDiscrepancy: discrepancyRatio > 0.1,
    discrepancies,
  };

  return { results, hasSeniorInfo, mode, warnings, diagnostics };
}

