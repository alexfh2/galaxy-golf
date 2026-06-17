import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Lock, Save, Grid3x3 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { computeScratchStableford, computeHandicapStableford } from '@/lib/scratchStableford';
import type { Tables } from '@/integrations/supabase/types';

type Round = Tables<'rounds'>;
type Result = Tables<'results'>;

type RowState = {
  stableford_points: string;
  raw_stableford_points: string;
  result_status: string;
  dirty: boolean;
  saving: boolean;
};

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completat' },
  { value: 'retired', label: 'Retirat' },
  { value: 'no_show', label: 'No s\'ha presentat' },
  { value: 'disqualified', label: 'Desqualificat' },
];

interface Props {
  round: Round;
  open: boolean;
  onClose: () => void;
}

export default function ManualResultEditDialog({ round, open, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [revalidated, setRevalidated] = useState(false);
  const [password, setPassword] = useState('');
  const [revalidating, setRevalidating] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const [holeEditResultId, setHoleEditResultId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRevalidated(false);
      setPassword('');
      setRows({});
      setPendingSave(null);
      setHoleEditResultId(null);
    }
  }, [open]);

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['admin-manual-edit-results', round.id],
    enabled: open && revalidated,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('results')
        .select('*, players(id, name)')
        .eq('round_id', round.id)
        .order('stableford_points', { ascending: false });
      if (error) throw error;
      return data as unknown as (Result & { players: { id: string; name: string } | null })[];
    },
  });

  useEffect(() => {
    if (!results) return;
    const next: Record<string, RowState> = {};
    for (const r of results) {
      next[r.id] = {
        stableford_points: r.stableford_points?.toString() ?? '',
        raw_stableford_points: r.raw_stableford_points?.toString() ?? '',
        result_status: r.result_status ?? 'completed',
        dirty: false,
        saving: false,
      };
    }
    setRows(next);
  }, [results]);

  const handleRevalidate = async () => {
    if (!user?.email || !password) return;
    setRevalidating(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    setRevalidating(false);
    if (error) {
      toast({
        title: 'Revalidació fallida',
        description: 'Contrasenya incorrecta.',
        variant: 'destructive',
      });
      return;
    }
    setPassword('');
    setRevalidated(true);
  };

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch, dirty: true },
    }));
  };

  const performSave = async (resultId: string) => {
    const row = rows[resultId];
    if (!row) return;
    setRows((prev) => ({ ...prev, [resultId]: { ...prev[resultId], saving: true } }));

    const sp = row.stableford_points.trim();
    const rsp = row.raw_stableford_points.trim();
    const update = {
      stableford_points: sp === '' ? null : Number(sp),
      raw_stableford_points: rsp === '' ? null : Number(rsp),
      result_status: row.result_status,
    };
    const { error } = await supabase.from('results').update(update).eq('id', resultId);
    setRows((prev) => ({ ...prev, [resultId]: { ...prev[resultId], saving: false } }));
    if (error) {
      toast({
        title: 'Error en desar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Correcció desada' });
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['rankings'] });
    queryClient.invalidateQueries({ queryKey: ['results'] });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Edició manual — {round.name}
            </DialogTitle>
            <DialogDescription>
              Correcció directa de resultats publicats. Les modificacions afecten els rànquings públics.
            </DialogDescription>
          </DialogHeader>

          {!revalidated ? (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4">
                <Lock className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1 space-y-1">
                  <div className="text-sm font-medium">Cal revalidar l'accés admin</div>
                  <div className="text-xs text-muted-foreground">
                    Introdueix la teva contrasenya per continuar. No es desa.
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Contrasenya</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRevalidate();
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Cancel·lar</Button>
                <Button onClick={handleRevalidate} disabled={!password || revalidating}>
                  {revalidating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Revalidar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">

              {isLoading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregant resultats…
                </div>
              )}

              {!isLoading && results && results.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No hi ha resultats per a aquesta jornada.
                </div>
              )}

              {!isLoading && results && results.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50 text-xs">
                        <th className="border border-border px-2 py-2 text-left">Jugador</th>
                        <th className="border border-border px-2 py-2 w-24">Stableford</th>
                        <th className="border border-border px-2 py-2 w-24">Raw Stbl.</th>
                        <th className="border border-border px-2 py-2 w-40">Estat</th>
                        <th className="border border-border px-2 py-2 w-32">Hoyos</th>
                        <th className="border border-border px-2 py-2 w-32">Acció</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => {
                        const row = rows[r.id];
                        if (!row) return null;
                        const fullName = r.players?.name ?? '—';
                        return (
                          <tr key={r.id} className={row.dirty ? 'bg-accent/10' : ''}>
                            <td className="border border-border px-2 py-1.5">{fullName}</td>
                            <td className="border border-border px-1 py-1">
                              <Input
                                type="number"
                                value={row.stableford_points}
                                onChange={(e) => updateRow(r.id, { stableford_points: e.target.value })}
                                className="h-8 text-center"
                              />
                            </td>
                            <td className="border border-border px-1 py-1">
                              <Input
                                type="number"
                                value={row.raw_stableford_points}
                                onChange={(e) => updateRow(r.id, { raw_stableford_points: e.target.value })}
                                className="h-8 text-center"
                              />
                            </td>
                            <td className="border border-border px-1 py-1">
                              <Select
                                value={row.result_status}
                                onValueChange={(v) => updateRow(r.id, { result_status: v })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="border border-border px-1 py-1 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setHoleEditResultId(r.id)}
                              >
                                <Grid3x3 className="h-3.5 w-3.5 mr-1" />
                                Editar hoyos
                              </Button>
                            </td>
                            <td className="border border-border px-1 py-1 text-center">
                              <Button
                                size="sm"
                                variant={row.dirty ? 'default' : 'outline'}
                                disabled={!row.dirty || row.saving}
                                onClick={() => setPendingSave(r.id)}
                              >
                                {row.saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Save className="h-3.5 w-3.5 mr-1" />
                                    Guardar
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={onClose}>Tancar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingSave} onOpenChange={(o) => !o && setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar correcció</AlertDialogTitle>
            <AlertDialogDescription>
              Esta corrección modificará el resultado publicado y afectará rankings públicos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSave) {
                  const id = pendingSave;
                  setPendingSave(null);
                  performSave(id);
                }
              }}
            >
              Guardar correcció
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {holeEditResultId && results && (() => {
        const r = results.find((x) => x.id === holeEditResultId);
        if (!r) return null;
        return (
          <HoleByHoleEditDialog
            open={!!holeEditResultId}
            onClose={() => setHoleEditResultId(null)}
            result={r}
            round={round}
            onSaved={async () => {
              await refetch();
              queryClient.invalidateQueries({ queryKey: ['rankings'] });
              queryClient.invalidateQueries({ queryKey: ['results'] });
            }}
          />
        );
      })()}
    </>
  );
}

// =============================================================
// Hole-by-hole edit sub-dialog
// =============================================================

interface HoleEditProps {
  open: boolean;
  onClose: () => void;
  result: Result & { players: { id: string; name: string } | null };
  round: Round;
  onSaved: () => void | Promise<void>;
}

function HoleByHoleEditDialog({ open, onClose, result, round, onSaved }: HoleEditProps) {
  const { toast } = useToast();
  const sc = (result.scorecard ?? null) as
    | { mode?: string; scores?: (number | null)[]; hole_points?: unknown[]; handicap_play?: number | null }
    | null;
  const isStablefordMode = sc?.mode === 'stableford_points';

  const initialScores: (number | null)[] = (() => {
    const arr = Array.isArray(sc?.scores) ? sc!.scores! : [];
    const out: (number | null)[] = [];
    for (let i = 0; i < 18; i++) {
      const v = arr[i];
      out.push(typeof v === 'number' ? v : null);
    }
    return out;
  })();

  const [scores, setScores] = useState<string[]>(
    initialScores.map((v) => (v == null ? '' : String(v)))
  );
  const [updateStableford, setUpdateStableford] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      setSaving(false);
      setUpdateStableford(false);
    }
  }, [open]);

  const coursePar = (round as unknown as { course_par?: unknown }).course_par;
  const parArr: number[] | null = Array.isArray(coursePar) && coursePar.length === 18
    ? (coursePar as number[])
    : null;

  const numericScores: (number | null)[] = scores.map((s) => {
    const t = s.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  });

  const previewScratch = parArr
    ? computeScratchStableford({ scores: numericScores }, parArr)
    : null;

  const handleSave = async () => {
    setSaving(true);
    const newScorecard = {
      ...(sc ?? {}),
      scores: numericScores,
    };
    const update: Record<string, unknown> = { scorecard: newScorecard };
    if (updateStableford && previewScratch != null) {
      update.stableford_points = previewScratch;
    }
    const { error } = await supabase
      .from('results')
      .update(update as never)
      .eq('id', result.id);
    setSaving(false);
    setConfirming(false);
    if (error) {
      toast({ title: 'Error en desar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tarja desada' });
    await onSaved();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Editar hoyos — {result.players?.name ?? '—'}
            </DialogTitle>
            <DialogDescription>
              Correcció hoyo a hoyo de la tarja. Els canvis afecten el resultat publicat.
            </DialogDescription>
          </DialogHeader>

          {isStablefordMode ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-3 text-sm text-amber-900 dark:text-amber-200">
              Esta tarjeta viene importada como puntos Stableford por hoyo; no se puede editar como golpes.
            </div>
          ) : (
            <div className="space-y-4">
              {[0, 9].map((start) => (
                <div key={start}>
                  <div className="text-xs text-muted-foreground mb-1">
                    {start === 0 ? 'Hoyos 1-9' : 'Hoyos 10-18'}
                  </div>
                  <div className="grid grid-cols-9 gap-1">
                    {scores.slice(start, start + 9).map((val, idx) => {
                      const i = start + idx;
                      return (
                        <div key={i} className="flex flex-col items-center">
                          <div className="text-[10px] text-muted-foreground">
                            {i + 1}{parArr ? ` · p${parArr[i]}` : ''}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            value={val}
                            onChange={(e) => {
                              const next = [...scores];
                              next[i] = e.target.value;
                              setScores(next);
                            }}
                            className="h-9 text-center px-1"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {parArr && (
                <div className="text-xs text-muted-foreground">
                  Stableford scratch calculat: <span className="font-medium">{previewScratch ?? '—'}</span>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateStableford}
                  onCheckedChange={(v) => setUpdateStableford(v === true)}
                  disabled={!parArr || previewScratch == null}
                />
                <span>
                  També actualitzar <code>stableford_points</code> amb el valor calculat
                  {parArr ? '' : ' (no disponible: falta course_par)'}
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel·lar</Button>
            {!isStablefordMode && (
              <Button onClick={() => setConfirming(true)} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> Guardar tarja
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={(o) => !o && !saving && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar correcció hoyo a hoyo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta corrección modificará la tarjeta hoyo a hoyo y puede afectar al resultado publicado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar tarja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
