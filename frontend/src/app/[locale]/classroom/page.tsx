'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Video, 
  Plus, 
  Users, 
  ArrowRight, 
  Radio, 
  Calendar, 
  Sparkles, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Clock,
  Trash2
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import BackButton from '@/components/BackButton';

interface Classroom {
  id: number;
  room_id: string;
  title: string;
  description: string;
  target_groups?: string | null;
  instructor_id: number;
  is_active: boolean;
  created_at: string;
  instructor?: { email: string; role: string };
}

interface GroupItem {
  id: number;
  name: string;
  level?: string | null;
  description?: string | null;
  members_count?: number;
}

export default function ClassroomHubPage() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  
  // Groups for invitations
  const [availableGroups, setAvailableGroups] = useState<GroupItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  // Join by code input
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Create room modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [customRoomId, setCustomRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setFetchError('');
    try {
      const [userRes, roomsRes, groupsRes] = await Promise.all([
        apiClient.get('/users/me'),
        apiClient.get('/classrooms/'),
        apiClient.get('/groups/').catch(() => ({ data: [] }))
      ]);
      setCurrentUserRole(userRes.data.role);
      setClassrooms(roomsRes.data);
      if (groupsRes.data && Array.isArray(groupsRes.data)) {
        setAvailableGroups(groupsRes.data);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push('/login');
        return;
      }
      const msg = err?.response?.data?.detail 
        || (err?.message === 'Network Error' || !err?.response
          ? 'Impossible de contacter le serveur backend. Vérifiez que le serveur FastAPI est bien démarré sur http://127.0.0.1:8000.'
          : 'Erreur lors du chargement des classes virtuelles.');
      setFetchError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    const code = joinCode.trim().toLowerCase();
    if (!code) {
      setJoinError('Veuillez renseigner un code de salle valide.');
      return;
    }
    router.push(`/classroom/${code}`);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newTitle.trim()) {
      setCreateError('Veuillez renseigner le titre de la classe.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await apiClient.post('/classrooms/', {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        room_id: customRoomId.trim() || undefined,
        target_groups: selectedGroupIds.length > 0 ? selectedGroupIds.join(',') : undefined
      });
      setIsModalOpen(false);
      router.push(`/classroom/${res.data.room_id}`);
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      setCreateError(e.response?.data?.detail || 'Erreur lors de la création de la classe virtuelle.');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePurgeHistory = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT tout l'historique des classes fermées ?")) return;
    setIsPurging(true);
    try {
      const res = await apiClient.delete('/classrooms/history/purge');
      alert(res.data.message || "Historique purgé avec succès.");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de la purge.");
    } finally {
      setIsPurging(false);
    }
  };

  const canCreateClass = ['admin', 'admin_manager', 'admin_limited', 'formateur', 'pedagogique'].includes(currentUserRole);

  return (
    <div className="min-h-screen px-4 py-24 max-w-6xl mx-auto space-y-12">
      <BackButton className="mb-[-20px]" />
      
      {/* Hero Section */}
      <div className="glass-card p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border border-border shadow-xl">
        <div className="space-y-4 max-w-xl z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/30 text-xs font-bold uppercase tracking-wider">
            <Radio size={14} className="animate-pulse" /> Direct & Visioconférence
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Classes <span className="text-brand-gradient">Virtuelles</span>
          </h1>
          <p className="text-text-secondary text-base leading-relaxed">
            Rejoignez des sessions de cours en direct avec vos formateurs et camarades. Activez votre caméra, votre micro et partagez votre écran pour collaborer.
          </p>

          {/* Join by Code Form */}
          <form onSubmit={handleJoinByCode} className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Ex: abc-defg-hij ou code..."
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-text-primary placeholder:text-text-secondary"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-surface hover:bg-surface-hover border border-border text-text-primary rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shrink-0"
            >
              Rejoindre <ArrowRight size={16} />
            </button>
          </form>
          {joinError && <p className="text-xs text-red-400 font-medium">{joinError}</p>}
        </div>

        {/* Right CTA / Action */}
        <div className="flex flex-col gap-4 w-full md:w-auto z-10">
          {canCreateClass && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary px-8 py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3 text-base"
            >
              <Plus size={20} /> Nouvelle Classe Virtuelle
            </button>
          )}
          <div className="p-4 rounded-2xl bg-surface/50 border border-border text-xs text-text-secondary space-y-1">
            <div className="flex items-center gap-2 text-text-primary font-semibold">
              <CheckCircle2 size={14} className="text-primary" /> Matériel requis :
            </div>
            <p>• Microphone pour intervenir</p>
            <p>• Caméra pour la vidéo</p>
            <p>• Partage d'écran PC intégré</p>
          </div>
        </div>

        {/* Decorative blur circle */}
        <div className="absolute right-0 top-0 w-80 h-80 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      </div>

      {/* Active Classes List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Video size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Sessions en cours et disponibles</h2>
              <p className="text-xs text-text-secondary">Sélectionnez une classe virtuelle pour participer au cours interactif.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['admin', 'admin_manager'].includes(currentUserRole) && (
              <button
                onClick={handlePurgeHistory}
                disabled={isPurging}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
              >
                {isPurging ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Purger l'historique
              </button>
            )}
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-surface-hover transition-colors"
            >
              {isLoading ? 'Actualisation...' : 'Actualiser'}
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-semibold transition-colors shrink-0"
            >
              Réessayer
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : classrooms.length === 0 ? (
          <div className="glass-card p-12 text-center text-text-secondary space-y-4 border border-dashed border-border">
            <Video size={48} className="mx-auto opacity-20" />
            <p className="text-lg font-semibold text-text-primary">Aucune classe virtuelle ouverte pour le moment</p>
            <p className="text-sm max-w-md mx-auto">
              {canCreateClass 
                ? 'Cliquez sur le bouton "Nouvelle Classe Virtuelle" ci-dessus pour lancer un direct avec vos étudiants.'
                : 'Les formateurs ouvriront bientôt des classes virtuelles en direct. Vous pouvez aussi rejoindre avec un code fourni par votre formateur.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((room) => {
              const instructorEmail = room.instructor?.email || `Formateur #${room.instructor_id}`;
              const instructorName = instructorEmail.split('@')[0];
              return (
                <div
                  key={room.id}
                  className="glass-card p-6 rounded-2xl flex flex-col justify-between space-y-6 hover:border-primary/40 transition-all border border-border group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-[11px] font-bold uppercase tracking-wider">
                        <Radio size={12} className="animate-pulse" /> En Direct
                      </span>
                      <span className="text-[11px] text-text-secondary font-mono bg-surface px-2 py-0.5 rounded border border-border">
                        {room.room_id}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-1">
                      {room.title}
                    </h3>

                    <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
                      {room.description || "Session de cours interactive en visioconférence."}
                    </p>

                    {room.target_groups && (
                      <div className="flex items-center gap-1.5 text-[11px] text-text-secondary bg-surface/80 px-2.5 py-1 rounded-lg border border-border/60">
                        <Users size={12} className="text-primary shrink-0" />
                        <span className="truncate font-medium">
                          {room.target_groups.split(',').map(gid => {
                            const g = availableGroups.find(ag => ag.id === Number(gid.trim()));
                            return g ? g.name : `Groupe #${gid.trim()}`;
                          }).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                        {instructorName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-text-primary">{instructorName}</p>
                        <p className="text-[10px]">Formateur</p>
                      </div>
                    </div>

                    <Link
                      href={`/classroom/${room.room_id}`}
                      className="w-full py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow"
                    >
                      <Video size={16} /> Rejoindre la classe
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Créer une Classe (Formateurs & Admin) */}
      {/* Create Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-2xl w-full p-6 sm:p-8 rounded-2xl border border-border space-y-5 relative animate-fade-in-up max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Video size={18} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold">Nouvelle Classe Virtuelle</h3>
                  <p className="text-xs text-text-secondary">Configurez et lancez une session en direct avec vos apprenants.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-text-secondary hover:text-white w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" /> {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-text-secondary mb-1.5">
                  Titre de la session *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Mathématiques - Intégrales & Algèbre"
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1.5">
                    Description / Ordre du jour (optionnel)
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Ex: Révision du chapitre 4 et exercices pratiques..."
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary outline-none text-sm resize-y"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-text-secondary mb-1.5">
                    Code de salle personnalisé (optionnel)
                  </label>
                  <input
                    type="text"
                    value={customRoomId}
                    onChange={(e) => setCustomRoomId(e.target.value)}
                    placeholder="Laisser vide pour génération automatique"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary outline-none text-sm font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Users size={13} />
                    </div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-primary">
                      Invitations aux classes
                    </label>
                    <span className="text-[11px] text-text-secondary font-normal">
                      ({availableGroups.length} groupe{availableGroups.length > 1 ? 's' : ''})
                    </span>
                  </div>
                  {availableGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedGroupIds.length === availableGroups.length) {
                          setSelectedGroupIds([]);
                        } else {
                          setSelectedGroupIds(availableGroups.map((g) => g.id));
                        }
                      }}
                      className="text-xs text-primary hover:text-primary-hover font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-primary/10 self-start sm:self-auto"
                    >
                      {selectedGroupIds.length === availableGroups.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Sélectionnez les groupes destinataires. Les membres recevront automatiquement une notification par messagerie interne et seront inscrits sur la feuille d'assiduité.
                </p>

                {availableGroups.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-secondary bg-surface/50 space-y-1">
                    <p className="font-semibold text-text-primary">Aucun groupe disponible</p>
                    <p>Créez des groupes dans le module <Link href="/group" className="text-primary underline">Groupes & Promotions</Link> pour inviter vos promotions en un clic.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                    {availableGroups.map((group) => {
                      const isSelected = selectedGroupIds.includes(group.id);
                      return (
                        <div
                          key={group.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedGroupIds((prev) => prev.filter((id) => id !== group.id));
                            } else {
                              setSelectedGroupIds((prev) => [...prev, group.id]);
                            }
                          }}
                          className={`p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all duration-150 flex items-start justify-between gap-3 select-none ${
                            isSelected
                              ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/40'
                              : 'bg-surface hover:bg-surface-hover border-border'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-semibold text-text-primary leading-snug">
                                {group.name}
                              </span>
                              {group.level && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium border border-primary/20 shrink-0">
                                  {group.level}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                              <Users size={13} className="shrink-0 text-primary/80" />
                              <span>{group.members_count || 0} apprenant{(group.members_count || 0) > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="accent-primary w-4 h-4 sm:w-5 sm:h-5 mt-0.5 pointer-events-none shrink-0 cursor-pointer"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedGroupIds.length > 0 ? (
                  <div className="p-2.5 px-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between text-xs">
                    <span className="text-primary font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={15} /> {selectedGroupIds.length} groupe{selectedGroupIds.length > 1 ? 's sélectionnés' : ' sélectionné'}
                    </span>
                    <span className="text-text-secondary text-[11px]">
                      {availableGroups
                        .filter((g) => selectedGroupIds.includes(g.id))
                        .reduce((acc, curr) => acc + (curr.members_count || 0), 0)}{' '}
                      apprenant(s) invité(s)
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-text-secondary italic">
                    Aucun groupe sélectionné (la session sera accessible librement par code de salle).
                  </p>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-3 bg-surface hover:bg-surface-hover rounded-xl text-sm font-semibold border border-border"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-1/2 btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : 'Lancer le direct'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
