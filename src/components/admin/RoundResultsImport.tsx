import { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Check, X, AlertTriangle, Search, Plus, Trash2, Upload, FileSpreadsheet } from 'lucide-react';
import { DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { parseExcelResults, type HoleMode, type ExcelDiagnostics } from '@/lib/parseExcelResults';
import type { Tables } from '@/integrations/supabase/types';

type Round = Tables<'rounds'>;

type ResultStatus = 'completed' | 'retired' | 'no_show' | 'disqualified';

interface ParsedResult {
  position: number;
  name: string;
  license: string;
  gender: string;
  handicap: number | null;
  handicap_play: number | null;
  age: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  scores: (number | null)[];
  source_url: string;
  play_date: string | null;
  /** Original category label from the source (GolfDirecto category name, Excel "Cat" column, etc.). */
  source_category: string | null;
  /** Detailed result status. 'completed' for normal cards. */
  result_status: ResultStatus;
  /** Partial Stableford reported by the source when the player retired (audit). */
  raw_stableford_points: number | null;
  _uid: string;
  _selected: boolean;
  _conflict_group?: string; // dup key if this row is part of an unresolved conflict
  _matched_player_id?: string;
  _url_index?: number;
  /** Legacy flag: true for any non-completed status (kept for backwards compat in this component). */
  _is_np?: boolean;
  _is_senior?: boolean;
  /** Excel-only: tells the save mutation how to serialise the scorecard. */
  _hole_mode?: HoleMode;
  /** Excel-only: stableford points per hole when _hole_mode === 'stableford_points'. */
  _hole_stableford?: (number | null)[];
}

const STATUS_BADGE: Record<ResultStatus, { label: string; effect: string; cls: string }> = {
  completed:     { label: 'Completat',    effect: '',                                       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  retired:       { label: 'Retirat',      effect: 'Ranking 0 · Bonus participació',        cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  no_show:       { label: 'No presentat', effect: '0 punts · sense bonus',                 cls: 'bg-muted text-muted-foreground border-border' },
  disqualified:  { label: 'Desqualificat',effect: '0 punts · sense bonus',                 cls: 'bg-red-50 text-red-700 border-red-200' },
};


interface Props {
  round: Round;
  onClose: () => void;
}

const SENIOR_AGE = 65;

// Normalise a name for duplicate detection: lowercase, strip accents, collapse spaces, trim
const normaliseName = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const dupKey = (r: ParsedResult): string => {
  if (r.license && r.license.trim()) return `lic:${r.license.trim().toUpperCase()}`;
  return `nm:${normaliseName(r.name)}`;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface DuplicateGroup {
  key: string;
  rows: ParsedResult[];
  autoResolved: boolean; // true if one row already _selected and the rest deselected automatically
  needsManual: boolean;
}

/**
 * Order priority for "first result wins" duplicate resolution:
 *  1. Earliest play_date (real game date when available).
 *  2. Tie-break: lowest _url_index (URL #1 before URL #2, etc.).
 * Never use Stableford or any score — always temporal/source order only.
 */
const compareFirstResult = (a: ParsedResult, b: ParsedResult): number => {
  const ad = a.play_date ?? '\uffff';
  const bd = b.play_date ?? '\uffff';
  if (ad < bd) return -1;
  if (ad > bd) return 1;
  const ai = a._url_index ?? Number.POSITIVE_INFINITY;
  const bi = b._url_index ?? Number.POSITIVE_INFINITY;
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
};

/**
 * Build duplicate-group view. Each group of >=2 rows sharing the same dupKey.
 *
 * Auto-resolution rules (reglamento GalaxyGolf 2026):
 *  - Only ever pick the FIRST result by date + URL order — never "best" by points.
 *  - Auto-pick allowed when the top row has a reliable signal (date or URL index)
 *    AND there's a strict order vs the next row (no full tie on both keys).
 *  - Otherwise the group is a manual conflict.
 */
const computeDuplicateGroups = (rows: ParsedResult[]): DuplicateGroup[] => {
  const map = new Map<string, ParsedResult[]>();
  for (const r of rows) {
    const k = dupKey(r);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, grp] of map.entries()) {
    if (grp.length < 2) continue;
    const sorted = [...grp].sort(compareFirstResult);
    const first = sorted[0];
    const second = sorted[1];
    const firstHasSignal = first.play_date != null || first._url_index != null;
    const fullTie =
      (first.play_date ?? null) === (second.play_date ?? null) &&
      (first._url_index ?? null) === (second._url_index ?? null);
    const autoResolved = firstHasSignal && !fullTie;
    groups.push({ key, rows: grp, needsManual: !autoResolved, autoResolved });
  }
  return groups;
};


const RoundResultsImport = ({ round, onClose }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urls, setUrls] = useState<{ url: string; date: string }[]>([{ url: '', date: round.date ?? '' }]);
  const [format, setFormat] = useState('stableford');
  const [excelPlayDate, setExcelPlayDate] = useState<string>(round.date ?? '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ParsedResult[]>([]);
  const [source, setSource] = useState('');
  const [importSource, setImportSource] = useState<'golfdirecto' | 'teeone' | 'excel' | 'generic' | ''>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importTab, setImportTab] = useState('url');
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [existingPlayerIds, setExistingPlayerIds] = useState<Set<string>>(new Set());
  const [needsSeniorFile, setNeedsSeniorFile] = useState(false);
  const [excelHoleMode, setExcelHoleMode] = useState<HoleMode>('strokes');
  const [excelDiagnostics, setExcelDiagnostics] = useState<ExcelDiagnostics | null>(null);
  const [stablefordTotalSource, setStablefordTotalSource] = useState<'excel' | 'sum'>('excel');
  const seniorFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('results').select('id, player_id', { count: 'exact' })
      .eq('round_id', round.id)
      .then(({ data, count }) => {
        setExistingCount(count ?? 0);
        setExistingPlayerIds(new Set((data ?? []).map(r => r.player_id)));
      });
  }, [round.id]);

  const addUrl = () => setUrls(prev => [...prev, { url: '', date: round.date ?? '' }]);
  const removeUrl = (idx: number) => setUrls(prev => prev.filter((_, i) => i !== idx));
  const updateUrl = (idx: number, value: string) =>
    setUrls(prev => prev.map((u, i) => i === idx ? { ...u, url: value } : u));
  const updateUrlDate = (idx: number, value: string) =>
    setUrls(prev => prev.map((u, i) => i === idx ? { ...u, date: value } : u));

  // Duplicate groups computed from raw rows — used for import summary/toasts.
  const duplicateGroups = useMemo(
    () => computeDuplicateGroups(results.filter(r => !r._is_np)),
    [results]
  );
  // Conflicts STILL pending manual resolution: derived from current _conflict_group tags,
  // so that after the admin picks one option the group disappears and Save is enabled.
  const unresolvedConflicts = useMemo(() => {
    const byKey = new Map<string, ParsedResult[]>();
    for (const r of results) {
      if (!r._conflict_group) continue;
      const arr = byKey.get(r._conflict_group) ?? [];
      arr.push(r);
      byKey.set(r._conflict_group, arr);
    }
    return Array.from(byKey.entries()).map(([key, rows]) => ({
      key,
      rows,
      needsManual: true,
      autoResolved: false,
    } as DuplicateGroup));
  }, [results]);
  const hasUnresolvedConflicts = unresolvedConflicts.length > 0;

  /**
   * Apply duplicate resolution to a fresh parsed list:
   *  - Auto-resolvable groups: keep the first row (by date, then URL index) selected; deselect rest.
   *  - Manual-conflict groups: deselect all rows in the group and tag them with _conflict_group.
   *  - Singletons: stay selected as imported.
   */
  const applyDuplicateResolution = (rows: ParsedResult[]): ParsedResult[] => {
    const groups = computeDuplicateGroups(rows);
    const groupByUid = new Map<string, DuplicateGroup>();
    for (const g of groups) {
      for (const r of g.rows) groupByUid.set(r._uid, g);
    }
    return rows.map(r => {
      const g = groupByUid.get(r._uid);
      if (!g) return { ...r, _conflict_group: undefined };
      if (g.needsManual) {
        return { ...r, _selected: false, _conflict_group: g.key };
      }
      const first = [...g.rows].sort(compareFirstResult)[0];
      return {
        ...r,
        _conflict_group: undefined,
        _selected: r._uid === first._uid,
      };
    });
  };

  const matchPlayers = async (parsed: ParsedResult[]) => {
    const { data: players } = await supabase.from('players').select('id, name, license');
    const w: string[] = [];

    const matched = parsed.map(r => {
      const match = players?.find(
        p => (r.license && p.license === r.license) ||
          normaliseName(p.name) === normaliseName(r.name)
      );
      if (!match && !r._is_np) w.push(`"${r.name}" no trobat a la base de dades`);
      return { ...r, _matched_player_id: match?.id };
    });

    const withGroups = applyDuplicateResolution(matched);
    setResults(withGroups);
    if (w.length > 0) setWarnings(w);
    return withGroups;
  };

  // --- Senior file cross-reference (Excel or PDF) ---
  const handleSeniorFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const seniorLicenses = new Set<string>();
      const seniorNames = new Set<string>();
      let seniorCount = 0;

      if (isPdf) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke('parse-senior-pdf', {
          body: { pdf_base64: base64 },
        });
        if (error) throw new Error(error.message);

        const players: { name: string; license: string }[] = data?.players || [];
        seniorCount = players.length;
        for (const p of players) {
          if (p.license) seniorLicenses.add(p.license.trim().toUpperCase());
          if (p.name) seniorNames.add(p.name.trim().toUpperCase());
        }
      } else {
        const buffer = await file.arrayBuffer();
        const { results: seniorRows } = parseExcelResults(buffer);
        seniorCount = seniorRows.length;
        for (const sr of seniorRows) {
          if (sr.license) seniorLicenses.add(sr.license.trim().toUpperCase());
          if (sr.name) seniorNames.add(sr.name.trim().toUpperCase());
        }
      }

      let matched = 0;
      setResults(prev => prev.map(r => {
        const matchByLic = r.license && seniorLicenses.has(r.license.trim().toUpperCase());
        const matchByName = seniorNames.has(r.name.trim().toUpperCase());
        const isSenior = !!(matchByLic || matchByName);
        if (isSenior) matched++;
        return { ...r, _is_senior: isSenior };
      }));

      setNeedsSeniorFile(false);
      toast({
        title: `${matched} jugadors sènior identificats`,
        description: `${seniorCount} jugadors al fitxer sènior, ${matched} coincidències amb els resultats.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: "Error llegint fitxer sènior", description: message, variant: 'destructive' });
    } finally {
      if (seniorFileRef.current) seniorFileRef.current.value = '';
    }
  };

  // --- Excel import ---
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setWarnings([]);
    setResults([]);
    setNeedsSeniorFile(false);
    setExcelDiagnostics(null);

    try {
      const buffer = await file.arrayBuffer();
      const {
        results: excelResults,
        hasSeniorInfo,
        warnings: parserWarnings,
        mode: parsedMode,
        diagnostics,
      } = parseExcelResults(buffer, { holeMode: excelHoleMode });

      setExcelDiagnostics(diagnostics);
      // Default: if a total column exists, prefer it; otherwise fall back to sum
      const defaultSource: 'excel' | 'sum' = diagnostics.totalColumn ? 'excel' : 'sum';
      setStablefordTotalSource(defaultSource);


      const playDate = excelPlayDate || null;

      const parsed: ParsedResult[] = excelResults
        // Keep retired & disqualified (they affect bonus / are audited).
        // 'no_show' rows remain skipped — same legacy behaviour, the spec
        // explicitly says "mantener omitido si ya se omitía".
        .filter(r => r.result_status !== 'no_show')
        .map(r => ({
          position: r.position,
          name: r.name,
          license: r.license,
          gender: r.gender,
          handicap: r.handicap_exact,
          handicap_play: r.handicap_play,
          age: r.age,
          // Retired: 0 in ranking, partial card kept in raw_stableford_points.
          // Disqualified: 0.
          stableford_points:
            r.result_status === 'completed' ? r.stableford_points
            : r.result_status === 'retired' ? 0
            : 0,
          scratch_score: r.result_status === 'completed' ? r.scratch_score : null,
          scores: r.scores,
          source_url: `excel:${file.name}`,
          play_date: playDate,
          source_category: r.category != null ? `Cat ${r.category}` : null,
          result_status: r.result_status,
          raw_stableford_points: r.result_status === 'retired' ? r.stableford_points : null,
          _uid: uid(),
          _selected: true,
          _is_np: r.result_status !== 'completed',
          _is_senior: r.age != null ? r.age >= SENIOR_AGE : r.is_senior,
          _hole_mode: parsedMode,
          _hole_stableford: r.hole_stableford,
        }));


      setSource(`Excel: ${file.name}`);
      setImportSource('excel');
      const matched = await matchPlayers(parsed);

      if (!hasSeniorInfo) {
        setNeedsSeniorFile(true);
      }

      if (parserWarnings.length > 0) {
        setWarnings(prev => [...parserWarnings, ...prev]);
      }

      const groups = computeDuplicateGroups(matched);
      const conflicts = groups.filter(g => g.needsManual).length;

      const modeLabel = parsedMode === 'stableford_points'
        ? 'Excel interpretat com punts Stableford per forat'
        : 'Excel interpretat com cops per forat';

      toast({
        title: `${matched.length} resultats importats des d'Excel`,
        description: `${modeLabel}. ${excelResults.filter(r => r.is_np).length} N.P exclosos.${!hasSeniorInfo ? ' Cal pujar classificació sènior.' : ''}${conflicts > 0 ? ` ⚠ ${conflicts} conflictes de duplicats per resoldre.` : ''}`,
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: "Error llegint Excel", description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- URL import ---
  const handleFetch = async () => {
    const validUrls = urls.filter(u => u.url.trim());
    if (validUrls.length === 0) return;
    setLoading(true);
    setWarnings([]);
    setResults([]);

    try {
      const responses = await Promise.all(
        validUrls.map(async (entry, urlIdx) => {
          const { data, error } = await supabase.functions.invoke('parse-results', {
            body: { url: entry.url.trim(), format },
          });
          if (error) throw new Error(`Error URL ${urlIdx + 1}: ${error.message}`);
          if (!data?.success) throw new Error(data?.error || `Error parsing URL ${urlIdx + 1}`);
          return { ...data, urlIdx, urlPlayDate: entry.date || null };
        })
      );

      const allParsed: ParsedResult[] = [];
      let detectedSource = '';

      for (const resp of responses) {
        detectedSource = detectedSource || resp.source;
        // Per-URL play_date precedence: admin-entered date > game_date from API > result.play_date
        const urlDate: string | null = resp.urlPlayDate || resp.game_date || null;
        for (const r of resp.results as (ParsedResult & { category?: string | null })[]) {
          allParsed.push({
            ...r,
            play_date: urlDate || r.play_date || null,
            source_category: r.source_category ?? r.category ?? null,
            age: null,
            scores: r.scores ?? [],
            _uid: uid(),
            _selected: true,
            _url_index: resp.urlIdx,
          });
        }
      }

      const parsed = allParsed.sort((a, b) => a.position - b.position);
      setSource(detectedSource);
      setImportSource(detectedSource as 'golfdirecto' | 'teeone' | 'generic');
      const matched = await matchPlayers(parsed);

      // Auto-import course par + handicap from GolfDirecto scorecards if missing
      let courseDataMsg = '';
      if (detectedSource === 'golfdirecto') {
        const roundPar = (round as Record<string, unknown>).course_par;
        const roundHcp = (round as Record<string, unknown>).course_handicap;
        const roundHcpW = (round as Record<string, unknown>).course_handicap_women;
        const hasPar = Array.isArray(roundPar) && roundPar.length === 18;
        const hasHcp = Array.isArray(roundHcp) && roundHcp.length === 18;
        const hasHcpW = Array.isArray(roundHcpW) && roundHcpW.length === 18;
        const updates: Record<string, unknown> = {};
        for (const resp of responses) {
          if (!hasPar && !updates.course_par && Array.isArray(resp.course_par) && resp.course_par.length === 18) {
            updates.course_par = resp.course_par;
          }
          if (!hasHcp && !updates.course_handicap && Array.isArray(resp.course_handicap) && resp.course_handicap.length === 18) {
            updates.course_handicap = resp.course_handicap;
          }
          if (!hasHcpW && !updates.course_handicap_women && Array.isArray(resp.course_handicap_women) && resp.course_handicap_women.length === 18) {
            updates.course_handicap_women = resp.course_handicap_women;
          }
        }
        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await supabase
            .from('rounds')
            .update(updates as never)
            .eq('id', round.id);
          if (!updErr) {
            const parts: string[] = [];
            if (updates.course_par) parts.push('par');
            if (updates.course_handicap) parts.push('handicap');
            if (updates.course_handicap_women) parts.push('handicap ♀');
            courseDataMsg = ` Dades del camp afegides (${parts.join(' + ')}).`;
            queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
          }
        }
      }

      const groups = computeDuplicateGroups(matched);
      
      const conflictCount = groups.filter(g => g.needsManual).length;
      const totalResults = responses.reduce((sum, r) => sum + (r.count || 0), 0);
      // Detailed auto-resolution summary (date vs URL order)
      const autoGroups = groups.filter(g => g.autoResolved);
      let autoMsg = '';
      if (autoGroups.length > 0) {
        const byDate = autoGroups.filter(g => {
          const sorted = [...g.rows].sort(compareFirstResult);
          return sorted[0].play_date !== sorted[1].play_date;
        }).length;
        const byUrl = autoGroups.length - byDate;
        const parts: string[] = [];
        if (byDate > 0) parts.push(`${byDate} per data més antiga`);
        if (byUrl > 0) parts.push(`${byUrl} per ordre d'URL (#1 abans que #2…)`);
        autoMsg = ` ${autoGroups.length} duplicat${autoGroups.length > 1 ? 's' : ''} resolt${autoGroups.length > 1 ? 's' : ''} automàticament (${parts.join(', ')}).`;
      }
      toast({
        title: `${matched.length} resultats llegits (${totalResults} brut, ${validUrls.length} URL${validUrls.length > 1 ? 's' : ''})`,
        description: `Font: ${detectedSource}.${courseDataMsg}${autoMsg}${conflictCount > 0 ? ` ⚠ ${conflictCount} conflicte${conflictCount > 1 ? 's' : ''} pendent${conflictCount > 1 ? 's' : ''} de resolució manual.` : ''}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: "Error d'importació", description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleResult = (idx: number) => {
    setResults(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      // Rows in unresolved conflicts must be resolved via the conflict UI
      if (r._conflict_group) return r;
      return { ...r, _selected: !r._selected };
    }));
  };

  /** Manual conflict resolution: pick one row in the group, drop the conflict tag. */
  const resolveConflict = (groupKey: string, chosenUid: string) => {
    setResults(prev => prev.map(r => {
      if (r._conflict_group !== groupKey) return r;
      return {
        ...r,
        _selected: r._uid === chosenUid,
        _conflict_group: undefined,
      };
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (hasUnresolvedConflicts) {
        throw new Error('Hi ha jugadors amb conflictes de duplicats sense resoldre.');
      }

      if (deleteExisting) {
        const { error: delError } = await supabase
          .from('results')
          .delete()
          .eq('round_id', round.id);
        if (delError) throw new Error(`Error eliminant resultats existents: ${delError.message}`);
      }

      const selected = results.filter(r => r._selected && !r._conflict_group);

      // Build extra_play_count per duplicate key (count of dropped rows in same key)
      const droppedByKey = new Map<string, number>();
      const allByKey = new Map<string, ParsedResult[]>();
      for (const r of results.filter(rr => !rr._is_np)) {
        const k = dupKey(r);
        const arr = allByKey.get(k) ?? [];
        arr.push(r);
        allByKey.set(k, arr);
      }
      for (const [k, arr] of allByKey.entries()) {
        if (arr.length < 2) continue;
        const keptCount = arr.filter(r => r._selected).length;
        droppedByKey.set(k, Math.max(0, arr.length - keptCount));
      }

      const newPlayers: string[] = [];

      for (const r of selected) {
        if (r._matched_player_id) continue;

        const birthYear = r.age != null ? new Date().getFullYear() - Math.floor(r.age) : null;
        const isSenior = r._is_senior ?? (r.age != null ? r.age >= SENIOR_AGE : false);

        const { data: newPlayer, error } = await supabase
          .from('players')
          .insert({
            name: r.name,
            license: r.license || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            current_handicap: r.handicap,
            initial_handicap: r.handicap,
            gender: r.gender === 'F' ? 'F' : r.gender === 'M' ? 'M' : null,
            is_senior: isSenior,
            birth_year: birthYear,
          })
          .select('id')
          .single();

        if (error) throw new Error(`Error creant jugador "${r.name}": ${error.message}`);
        r._matched_player_id = newPlayer.id;
        newPlayers.push(r.name);
      }

      // Detect already-existing results for these players (if not deleting first)
      const duplicatedExisting: string[] = [];
      if (!deleteExisting) {
        for (const r of selected) {
          if (r._matched_player_id && existingPlayerIds.has(r._matched_player_id)) {
            duplicatedExisting.push(r.name);
          }
        }
      }

      const toInsert = selected.filter(
        r => deleteExisting || !r._matched_player_id || !existingPlayerIds.has(r._matched_player_id)
      );

      const payloads = toInsert.map(r => {
        // Override stableford_points with computed sum when admin chose that source.
        let stb = r.stableford_points;
        if (
          r._hole_mode === 'stableford_points' &&
          stablefordTotalSource === 'sum' &&
          r._hole_stableford && r._hole_stableford.length > 0
        ) {
          const valid = r._hole_stableford.filter((v): v is number => v != null);
          stb = valid.length > 0 ? valid.reduce((s, n) => s + n, 0) : null;
        }
        return {
          round_id: round.id,
          player_id: r._matched_player_id!,
          stableford_points: stb,
          scratch_score: r.scratch_score,
          handicap_at_round: r.handicap,
          source_url: r.source_url,
          play_date: r.play_date,
          extra_play_count: droppedByKey.get(dupKey(r)) ?? 0,
          import_source: importSource || null,
          official_position: Number.isFinite(r.position) && r.position > 0 ? r.position : null,
          official_category: r.source_category ?? null,
          scorecard: r._hole_mode === 'stableford_points'
            ? (r._hole_stableford && r._hole_stableford.length > 0
                ? {
                    mode: 'stableford_points',
                    hole_points: r._hole_stableford,
                    handicap_play: r.handicap_play,
                    total_source: stablefordTotalSource,
                    note: 'Excel import: hole values were Stableford points, not strokes. No real per-hole scores available.',
                  }
                : null)
            : (r.scores.length > 0
                ? { scores: r.scores, handicap_play: r.handicap_play }
                : null),
        };
      });


      if (payloads.length === 0 && duplicatedExisting.length > 0) {
        throw new Error(
          `Tots els jugadors seleccionats ja tenen resultat en aquesta jornada (${duplicatedExisting.length}). Marca "Eliminar resultats existents" per substituir-los.`
        );
      }

      if (payloads.length > 0) {
        const { error } = await supabase.from('results').insert(payloads);
        if (error) throw error;
      }

      for (const r of toInsert) {
        if (r._matched_player_id) {
          const updates: Record<string, unknown> = {};
          if (r.handicap != null) updates.current_handicap = r.handicap;
          if (r.gender === 'F' || r.gender === 'M') updates.gender = r.gender;
          if (r._is_senior != null) updates.is_senior = r._is_senior;
          if (r.age != null) {
            updates.birth_year = new Date().getFullYear() - Math.floor(r.age);
            updates.is_senior = r.age >= SENIOR_AGE;
          }
          if (Object.keys(updates).length > 0) {
            await supabase
              .from('players')
              .update(updates as never)
              .eq('id', r._matched_player_id);
          }
        }
      }

      const skipped = results.filter(r => !r._selected && !r._is_np);

      // Defensive validation: flag suspiciously low stableford totals when a full
      // 18-hole scorecard exists. Likely a parser column-misalignment (e.g. category
      // position read into stableford_points). Only a warning — does not block import.
      const suspiciousLowStb: string[] = [];
      for (const p of payloads) {
        const stb = p.stableford_points;
        const sc = p.scorecard as { scores?: unknown[]; hole_points?: unknown[] } | null;
        const holes = Array.isArray(sc?.scores)
          ? sc!.scores!.length
          : Array.isArray(sc?.hole_points)
            ? sc!.hole_points!.length
            : 0;
        if (stb != null && stb < 10 && holes >= 18) {
          const name = toInsert.find(r => r._matched_player_id === p.player_id)?.name ?? p.player_id;
          suspiciousLowStb.push(`${name} (${stb} pts amb tarjeta completa)`);
        }
      }

      const allWarnings: string[] = [];
      if (duplicatedExisting.length > 0) {
        allWarnings.push(
          `${duplicatedExisting.length} jugadors ja tenien resultat i s'han ignorat: ${duplicatedExisting.join(', ')}`
        );
      }
      if (suspiciousLowStb.length > 0) {
        allWarnings.push(
          `⚠ Stableford sospitosament baix (possible error d'importació): ${suspiciousLowStb.join('; ')}`
        );
      }

      await supabase.from('import_logs').insert({
        round_id: round.id,
        source: source || (importTab === 'excel' ? 'excel' : 'url'),
        source_url: importTab === 'excel' ? source : urls.filter(u => u.url.trim()).map(u => u.url).join(' | '),
        records_imported: payloads.length,
        records_skipped: skipped.length,
        skipped_records: skipped.map(r => ({
          name: r.name,
          license: r.license,
          play_date: r.play_date,
          stableford_points: r.stableford_points,
          reason: 'duplicate_or_deselected',
        })),
        warnings: allWarnings,

        status: 'completed',
      });

      return { imported: payloads.length, newPlayers, duplicatedExisting };
    },
    onSuccess: ({ imported, newPlayers, duplicatedExisting }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
      let msg = `${imported} resultats importats.`;
      if (newPlayers.length > 0) msg += ` ${newPlayers.length} jugadors nous creats.`;
      if (duplicatedExisting.length > 0) {
        msg += ` ${duplicatedExisting.length} ignorats per ja existir.`;
      }
      toast({ title: 'Importació completada', description: msg });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const selectedCount = results.filter(r => r._selected && !r._conflict_group).length;
  const visibleResults = results.filter(r => !r._conflict_group);

  return (
    <div className="space-y-4">
      <DialogDescription className="text-sm text-muted-foreground">
        Importa resultats des d'un fitxer Excel o des d'URLs (GolfDirecto / Teeone).
        Si un jugador hi apareix més d'un cop, només es conserva el primer resultat (per data); en cas de dubte es bloqueja la importació per a resolució manual.
      </DialogDescription>

      {existingCount != null && existingCount > 0 && (
        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
          <Checkbox
            id="delete-existing"
            checked={deleteExisting}
            onCheckedChange={(checked) => setDeleteExisting(checked === true)}
          />
          <label htmlFor="delete-existing" className="text-sm cursor-pointer">
            <span className="font-medium">Eliminar {existingCount} resultats existents</span>
            <span className="text-muted-foreground ml-1">abans d'importar (substituir)</span>
          </label>
        </div>
      )}

      <Tabs value={importTab} onValueChange={(v) => { setImportTab(v); setResults([]); setWarnings([]); }}>
        <TabsList className="w-full">
          <TabsTrigger value="excel" className="flex-1 gap-1">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </TabsTrigger>
          <TabsTrigger value="url" className="flex-1 gap-1">
            <Search className="h-3.5 w-3.5" /> URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="excel" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Fitxer Excel amb resultats (.xlsx)</Label>
            <p className="text-xs text-muted-foreground">
              Columnes: Pos, Licencia, Nombre, Hex, NVH, Niv, Edad, Sex, Cat, Hpu, Total, H1-H18, Totalx.
              N.P exclosos. Sènior = edat ≥ 65 o Niv = S.
            </p>

            <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-3">
              <Label className="text-xs font-semibold">Format de columnes per forat</Label>
              <Select value={excelHoleMode} onValueChange={(v) => setExcelHoleMode(v as HoleMode)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strokes">Cops per forat (per defecte)</SelectItem>
                  <SelectItem value="stableford_points">Punts Stableford per forat</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Selecciona "Punts Stableford per forat" si l'Excel ja conté els punts obtinguts en cada forat,
                no els cops realitzats. En aquest mode no es calculen birdies, eagles ni scratch oficial.
              </p>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="excel-date" className="text-xs">Data de joc d'aquest fitxer</Label>
                <Input
                  id="excel-date"
                  type="date"
                  value={excelPlayDate}
                  onChange={(e) => setExcelPlayDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'Llegint...' : 'Seleccionar Excel'}
              </Button>
            </div>
          </div>

          {needsSeniorFile && results.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/50">
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      No s'ha detectat informació de sènior (ni Edat ni Niv)
                    </p>
                    <p className="text-xs text-amber-700">
                      Puja la classificació sènior per identificar automàticament els jugadors sènior.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={seniorFileRef}
                    type="file"
                    accept=".xlsx,.xls,.pdf"
                    onChange={handleSeniorFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => seniorFileRef.current?.click()}
                    className="w-full"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Pujar classificació sènior
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="url" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">URLs dels resultats</Label>
            <p className="text-xs text-muted-foreground">
              Afegeix una URL per cada dia de joc i indica'n la data. La data permet conservar automàticament el primer resultat quan un jugador apareix més d'un cop.
            </p>
            {urls.map((entry, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={entry.url}
                  onChange={(e) => updateUrl(idx, e.target.value)}
                  placeholder={`URL dia ${idx + 1} — https://www.golfdirecto.com/...`}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={entry.date}
                  onChange={(e) => updateUrlDate(idx, e.target.value)}
                  className="w-[150px]"
                  title="Data de joc"
                />
                {urls.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeUrl(idx)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addUrl}>
                <Plus className="h-3 w-3 mr-1" /> Afegir URL
              </Button>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stableford">Stableford</SelectItem>
                  <SelectItem value="medal">Medal</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleFetch} disabled={loading || urls.every(u => !u.url.trim())} className="ml-auto">
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Llegint...' : 'Llegir resultats'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {importTab === 'excel' && excelHoleMode === 'stableford_points' && excelDiagnostics && (
        <Card className="border-amber-400/50 bg-amber-50/5">
          <CardContent className="py-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-300 mb-1">
                  Diagnòstic Excel — Mode "Punts Stableford per forat"
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Revisa que les columnes detectades com a forats i com a total siguin les correctes
                  abans d'importar.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-md border border-border/60 bg-background/40 p-2 space-y-1">
                <p className="font-semibold">
                  Columnes detectades com a forats ({excelDiagnostics.holeColumns.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {excelDiagnostics.holeColumns.map((h) => (
                    <Badge key={h.index} variant="outline" className="font-mono text-[10px]">
                      [{h.index}] {h.name || '—'}
                    </Badge>
                  ))}
                </div>
                {excelDiagnostics.holeColumns.length !== 18 && (
                  <p className="text-[11px] text-destructive font-semibold">
                    ⚠ S'esperaven 18 columnes, detectades {excelDiagnostics.holeColumns.length}
                  </p>
                )}
              </div>

              <div className="rounded-md border border-border/60 bg-background/40 p-2 space-y-1">
                <p className="font-semibold">Columna total Stableford</p>
                {excelDiagnostics.totalColumn ? (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    [{excelDiagnostics.totalColumn.index}] {excelDiagnostics.totalColumn.name}
                  </Badge>
                ) : (
                  <p className="text-destructive text-[11px]">No s'ha detectat columna total</p>
                )}
                <p className="text-[11px] text-muted-foreground pt-1">
                  Jugadors amb total: {excelDiagnostics.withTotalCount} / {excelDiagnostics.playerCount}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Discrepàncies: <span className={excelDiagnostics.massDiscrepancy ? 'text-destructive font-bold' : 'font-semibold'}>
                    {excelDiagnostics.discrepancyCount}
                  </span> ({(excelDiagnostics.discrepancyRatio * 100).toFixed(1)}%)
                </p>
              </div>
            </div>

            {excelDiagnostics.discrepancies.length > 0 && (
              <div className="rounded-md border border-border/60 bg-background/40 p-2">
                <p className="text-xs font-semibold mb-2">
                  Primeres {Math.min(5, excelDiagnostics.discrepancies.length)} discrepàncies
                </p>
                <div className="overflow-x-auto">
                  <table className="text-[11px] w-full font-mono">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left pr-2">Jugador</th>
                        <th className="text-left pr-2">Valors 18 forats</th>
                        <th className="text-right pr-2">Suma</th>
                        <th className="text-right pr-2">Excel</th>
                        <th className="text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelDiagnostics.discrepancies.slice(0, 5).map((d, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="pr-2 py-1">{d.name}</td>
                          <td className="pr-2 py-1">
                            [{d.holes.map((v) => (v == null ? '—' : v)).join(', ')}]
                          </td>
                          <td className="pr-2 py-1 text-right">{d.computed}</td>
                          <td className="pr-2 py-1 text-right">{d.excel}</td>
                          <td className="text-right font-bold text-amber-400">
                            {d.diff > 0 ? `+${d.diff}` : d.diff}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {excelDiagnostics.massDiscrepancy && (
              <div className="rounded-md border border-destructive/60 bg-destructive/10 p-2">
                <p className="text-xs font-bold text-destructive">
                  ⚠ Hi ha massa discrepàncies entre els punts per forat i el total Stableford.
                  Revisa el mapeig de columnes abans d'importar.
                </p>
              </div>
            )}

            <div className="space-y-1.5 rounded-md border border-border/60 bg-background/40 p-2">
              <Label className="text-xs font-semibold">Font del total Stableford</Label>
              <RadioGroup
                value={stablefordTotalSource}
                onValueChange={(v) => setStablefordTotalSource(v as 'excel' | 'sum')}
                className="space-y-1"
              >
                <div className="flex items-start gap-2 text-xs">
                  <RadioGroupItem
                    value="excel"
                    id="stb-src-excel"
                    disabled={!excelDiagnostics.totalColumn}
                    className="mt-0.5"
                  />
                  <label htmlFor="stb-src-excel" className="cursor-pointer">
                    Usar total Stableford de l'Excel
                    {excelDiagnostics.totalColumn && (
                      <span className="text-muted-foreground ml-1">
                        (columna "{excelDiagnostics.totalColumn.name}")
                      </span>
                    )}
                  </label>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <RadioGroupItem value="sum" id="stb-src-sum" className="mt-0.5" />
                  <label htmlFor="stb-src-sum" className="cursor-pointer">
                    Usar suma de punts per forat
                    {excelDiagnostics.massDiscrepancy && (
                      <span className="text-destructive ml-1 font-semibold">
                        (bloquejat: discrepàncies massives)
                      </span>
                    )}
                  </label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      )}


      {warnings.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-yellow-800 mb-1">
                  {warnings.length} avisos — jugadors nous es crearan automàticament
                </p>
                <ul className="text-xs text-yellow-700 space-y-0.5 max-h-24 overflow-y-auto">
                  {warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conflict resolution block */}
      {unresolvedConflicts.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm font-semibold text-destructive">
                Hi ha jugadors amb diversos resultats en aquesta jornada. Selecciona manualment quin resultat s'ha de conservar abans d'importar.
              </p>
            </div>
            {unresolvedConflicts.map(group => (
              <div key={group.key} className="border border-destructive/40 rounded-md p-3 space-y-2 bg-background">
                <p className="text-xs font-semibold">
                  {group.rows[0].name}
                  {group.rows[0].license && <span className="ml-1 text-muted-foreground font-mono">({group.rows[0].license})</span>}
                </p>
                <RadioGroup onValueChange={(v) => resolveConflict(group.key, v)}>
                  {group.rows.map(r => (
                    <div key={r._uid} className="flex items-center gap-3 text-xs border rounded-md p-2">
                      <RadioGroupItem value={r._uid} id={r._uid} />
                      <label htmlFor={r._uid} className="flex-1 flex flex-wrap gap-x-4 gap-y-1 cursor-pointer">
                        <span><span className="text-muted-foreground">Data:</span> {r.play_date || '—'}</span>
                        <span><span className="text-muted-foreground">Pos:</span> {r.position || '—'}</span>
                        <span><span className="text-muted-foreground">Hcp:</span> {r.handicap ?? '—'}</span>
                        <span><span className="text-muted-foreground">Stb:</span> {r.stableford_points ?? '—'}</span>
                        <span><span className="text-muted-foreground">Scr:</span> {r.scratch_score ?? '—'}</span>
                        {r._url_index != null && (
                          <span className="text-muted-foreground">URL #{r._url_index + 1}</span>
                        )}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {selectedCount} / {visibleResults.length} resultats seleccionats
              {source && <Badge variant="outline" className="ml-2 text-xs">{source}</Badge>}
              {importSource === 'excel' && results.some(r => r._hole_mode) && (
                <Badge
                  variant="outline"
                  className={`ml-2 text-xs ${
                    results[0]?._hole_mode === 'stableford_points'
                      ? 'border-amber-400/60 text-amber-300'
                      : 'border-emerald-400/60 text-emerald-300'
                  }`}
                >
                  {results[0]?._hole_mode === 'stableford_points'
                    ? 'Excel: punts Stableford per forat'
                    : 'Excel: cops per forat'}
                </Badge>
              )}
              {unresolvedConflicts.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {unresolvedConflicts.length} conflictes
                </Badge>
              )}
            </p>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                selectedCount === 0 ||
                hasUnresolvedConflicts ||
                (importSource === 'excel' &&
                  results[0]?._hole_mode === 'stableford_points' &&
                  stablefordTotalSource === 'sum' &&
                  excelDiagnostics?.massDiscrepancy === true)
              }
              title={
                hasUnresolvedConflicts
                  ? 'Resol els conflictes de duplicats primer'
                  : excelDiagnostics?.massDiscrepancy && stablefordTotalSource === 'sum'
                  ? `Hi ha massa discrepàncies. Canvia a "Usar total Stableford de l'Excel" o revisa el mapeig.`
                  : ''
              }
            >
              <Check className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Guardant...' : 'Guardar resultats'}
            </Button>
          </div>

          <div className="border rounded-md overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-2 text-left w-8"></th>
                  <th className="p-2 text-left">Pos</th>
                  <th className="p-2 text-left">Jugador</th>
                  <th className="p-2 text-left">Llicència</th>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-right">Hcp</th>
                  <th className="p-2 text-right">Hpu</th>
                  <th className="p-2 text-right">Stb</th>
                  <th className="p-2 text-right">Scr</th>
                  {importTab === 'excel' && <th className="p-2 text-center">Edat</th>}
                  <th className="p-2 text-center">Estat</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((r) => {
                  const idx = results.indexOf(r);
                  const alreadyExists = r._matched_player_id && existingPlayerIds.has(r._matched_player_id);
                  return (
                    <tr
                      key={r._uid}
                      className={`border-b last:border-0 ${!r._selected ? 'opacity-40' : ''} ${r._matched_player_id ? '' : 'bg-yellow-50/50'}`}
                    >
                      <td className="p-2">
                        <button
                          onClick={() => toggleResult(idx)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {r._selected ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3" />}
                        </button>
                      </td>
                      <td className="p-2 font-mono">{r.position}</td>
                      <td className="p-2 font-medium">
                        {r.name}
                        {r.gender && <span className="text-muted-foreground ml-1">({r.gender})</span>}
                        {r._is_senior && <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">Sènior</Badge>}
                      </td>
                      <td className="p-2 font-mono text-muted-foreground">{r.license || '—'}</td>
                      <td className="p-2 font-mono text-muted-foreground">{r.play_date || '—'}</td>
                      <td className="p-2 text-right font-mono">{r.handicap ?? '—'}</td>
                      <td className="p-2 text-right font-mono">{r.handicap_play ?? '—'}</td>
                      <td className="p-2 text-right font-mono font-bold">{r.stableford_points ?? '—'}</td>
                      <td className="p-2 text-right font-mono text-muted-foreground">{r.scratch_score ?? '—'}</td>
                      {importTab === 'excel' && (
                        <td className="p-2 text-center font-mono text-muted-foreground">{r.age ?? '—'}</td>
                      )}
                      <td className="p-2 text-center space-x-1">
                        {r._matched_player_id ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">Trobat</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">Nou</Badge>
                        )}
                        {alreadyExists && !deleteExisting && (
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">Ja existeix</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoundResultsImport;
