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
import { Loader2, Lock, Save } from 'lucide-react';
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

  useEffect(() => {
    if (!open) {
      setRevalidated(false);
      setPassword('');
      setRows({});
      setPendingSave(null);
    }
  }, [open]);

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['admin-manual-edit-results', round.id],
    enabled: open && revalidated,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('results')
        .select('*, players(id, name, last_name)')
        .eq('round_id', round.id)
        .order('stableford_points', { ascending: false });
      if (error) throw error;
      return data as (Result & { players: { id: string; name: string; last_name: string | null } | null })[];
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
    const update: Record<string, unknown> = {
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
              <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Edició hoyo a hoyo pendiente de próxima fase.
              </div>

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
                        <th className="border border-border px-2 py-2 w-32">Acció</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => {
                        const row = rows[r.id];
                        if (!row) return null;
                        const fullName = r.players
                          ? `${r.players.name}${r.players.last_name ? ' ' + r.players.last_name : ''}`
                          : '—';
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
    </>
  );
}
