import { useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Check, X, Phone, Upload, Trash2, User as UserIcon, Search } from 'lucide-react';

type EditState = {
  name: string;
  club: string;
  phone: string;
  current_handicap: string;
  gender: string;
};

const PHOTO_BUCKET = 'photos';
const PHOTO_PREFIX = 'players';

const extractStoragePath = (url: string): string | null => {
  if (!url) return null;
  const marker = `/object/public/${PHOTO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
};

const AdminPlayers = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'handicap'>('name');
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: playersRaw, isLoading } = useQuery({
    queryKey: ['admin-players'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const players = useMemo(() => {
    let list = playersRaw ? [...playersRaw] : [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p: any) => (p.name ?? '').toLowerCase().includes(q));
    }
    if (sortBy === 'name') {
      list.sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''));
    } else if (sortBy === 'handicap') {
      list.sort((a: any, b: any) => {
        const ha = a.current_handicap == null ? Infinity : Number(a.current_handicap);
        const hb = b.current_handicap == null ? Infinity : Number(b.current_handicap);
        return ha - hb;
      });
    }
    return list;
  }, [playersRaw, searchQuery, sortBy]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EditState> }) => {
      const payload: any = {
        name: patch.name?.trim(),
        club: patch.club?.trim() || null,
        phone: patch.phone?.trim() || null,
        gender: patch.gender || null,
        current_handicap:
          patch.current_handicap === '' || patch.current_handicap == null
            ? null
            : Number(patch.current_handicap),
      };
      const { error } = await supabase.from('players').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players'] });
      toast({ title: 'Jugador actualitzat' });
      setEditingId(null);
      setEdit(null);
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const handleUpload = async (player: any, file: File) => {
    if (!file) return;
    setUploadingId(player.id);
    try {
      // Remove previous photo if it lives in our bucket
      if (player.photo_url) {
        const prev = extractStoragePath(player.photo_url);
        if (prev) await supabase.storage.from(PHOTO_BUCKET).remove([prev]);
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${PHOTO_PREFIX}/${player.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      const { error: updErr } = await supabase
        .from('players')
        .update({ photo_url: pub.publicUrl })
        .eq('id', player.id);
      if (updErr) throw updErr;
      qc.invalidateQueries({ queryKey: ['admin-players'] });
      toast({ title: 'Foto actualitzada' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeletePhoto = async (player: any) => {
    if (!player.photo_url) return;
    if (!confirm('Eliminar la foto d\'aquest jugador?')) return;
    setUploadingId(player.id);
    try {
      const prev = extractStoragePath(player.photo_url);
      if (prev) await supabase.storage.from(PHOTO_BUCKET).remove([prev]);
      const { error } = await supabase
        .from('players')
        .update({ photo_url: null })
        .eq('id', player.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['admin-players'] });
      toast({ title: 'Foto eliminada' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEdit({
      name: p.name ?? '',
      club: p.club ?? '',
      phone: p.phone ?? '',
      current_handicap: p.current_handicap?.toString() ?? '',
      gender: p.gender ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const saveEdit = () => {
    if (!editingId || !edit) return;
    updateMutation.mutate({ id: editingId, patch: edit });
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-2xl font-bold mb-6">Jugadors</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cercar per nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Ordenar per:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'handicap')}
            className="h-9 rounded border border-border bg-background px-3 text-sm"
          >
            <option value="name">Alfabètic</option>
            <option value="handicap">Hàndicap</option>
          </select>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foto</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Llicència</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Telèfon</TableHead>
                <TableHead>Últim HCP</TableHead>
                <TableHead>Gènere</TableHead>
                <TableHead className="text-right">Accions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregant...
                  </TableCell>
                </TableRow>
              ) : !players?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hi ha jugadors registrats
                  </TableCell>
                </TableRow>
              ) : (
                players.map((player: any) => {
                  const isEditing = editingId === player.id;
                  const isUploading = uploadingId === player.id;
                  return (
                    <TableRow key={player.id}>
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center border border-border/60">
                            {player.photo_url ? (
                              <img
                                src={player.photo_url}
                                alt={player.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              ref={(el) => (fileInputs.current[player.id] = el)}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUpload(player, f);
                                e.target.value = '';
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              disabled={isUploading}
                              onClick={() => fileInputs.current[player.id]?.click()}
                              title={player.photo_url ? 'Reemplaçar foto' : 'Pujar foto'}
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                            {player.photo_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-destructive hover:text-destructive"
                                disabled={isUploading}
                                onClick={() => handleDeletePhoto(player)}
                                title="Eliminar foto"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium min-w-[180px]">
                        {isEditing ? (
                          <Input
                            value={edit!.name}
                            onChange={(e) => setEdit({ ...edit!, name: e.target.value })}
                            className="h-8"
                          />
                        ) : (
                          player.name
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{player.license}</TableCell>
                      <TableCell className="text-muted-foreground min-w-[140px]">
                        {isEditing ? (
                          <Input
                            value={edit!.club}
                            onChange={(e) => setEdit({ ...edit!, club: e.target.value })}
                            className="h-8"
                          />
                        ) : (
                          player.club || '—'
                        )}
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        {isEditing ? (
                          <Input
                            type="tel"
                            placeholder="+34..."
                            value={edit!.phone}
                            onChange={(e) => setEdit({ ...edit!, phone: e.target.value })}
                            className="h-8"
                          />
                        ) : player.phone ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {player.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[90px]">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.1"
                            value={edit!.current_handicap}
                            onChange={(e) =>
                              setEdit({ ...edit!, current_handicap: e.target.value })
                            }
                            className="h-8 w-20"
                          />
                        ) : (
                          player.current_handicap ?? '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <select
                            value={edit!.gender}
                            onChange={(e) => setEdit({ ...edit!, gender: e.target.value })}
                            className="h-8 rounded border border-border bg-background px-2 text-sm"
                          >
                            <option value="">—</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </select>
                        ) : player.gender === 'F' ? (
                          <Badge variant="secondary">Femenina</Badge>
                        ) : (
                          <span className="text-muted-foreground">M</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={saveEdit}
                              disabled={updateMutation.isPending}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(player)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlayers;
