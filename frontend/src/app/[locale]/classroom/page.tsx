'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
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
  Trash2,
  Square
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

interface ClassroomInvitationItem {
  id: number;
  classroom_id: number;
  inviter_id: number;
  invitee_id: number;
  status: string;
  created_at: string;
  classroom?: Classroom;
  inviter?: { email: string; role: string };
}

export default function ClassroomHubPage() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  
  // Pending Invitations
  const [myInvitations, setMyInvitations] = useState<ClassroomInvitationItem[]>([]);
  const [processingInvId, setProcessingInvId] = useState<number | null>(null);

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
  const [isPrivate, setIsPrivate] = useState(true);
  const [autoInvitations, setAutoInvitations] = useState(false);
  const [allowScreenSharing, setAllowScreenSharing] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const extractErrorMessage = (err: any, fallback: string): string => {
    if (err?.response?.status === 401) return 'Session expirée. Veuillez vous reconnecter.';
    if (err?.message === 'Network Error' || !err?.response) {
      return 'Impossible de contacter le serveur backend. Vérifiez que le serveur FastAPI est démarré sur http://127.0.0.1:8000.';
    }
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const msgs = detail.map((d: any) => typeof d === 'string' ? d : d?.msg || JSON.stringify(d));
      return msgs.join(', ');
    }
    if (typeof detail === 'object' && detail !== null) {
      return detail.message || JSON.stringify(detail);
    }
    return fallback;
  };

  const fetchData = async () => {
    setIsLoading(true);
    setFetchError('');

    // 1. Get Current User
    try {
      const userRes = await apiClient.get('/users/me');
      if (userRes.data?.role) {
        setCurrentUserRole(userRes.data.role);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push('/login');
        return;
      }
    }

    // 2. Get Classrooms
    try {
      const roomsRes = await apiClient.get('/classrooms/');
      if (Array.isArray(roomsRes.data)) {
        setClassrooms(roomsRes.data);
      }
    } catch (err: any) {
      setFetchError(extractErrorMessage(err, 'Erreur lors du chargement des classes virtuelles.'));
    }

    // 3. Get My Invitations
    try {
      const invRes = await apiClient.get('/classrooms/invitations/my-invitations');
      if (Array.isArray(invRes.data)) {
        setMyInvitations(invRes.data);
      }
    } catch {
      setMyInvitations([]);
    }

    // 4. Get Groups (silently handle if forbidden for non-admins)
    try {
      const groupsRes = await apiClient.get('/groups/');
      if (groupsRes.data && Array.isArray(groupsRes.data)) {
        setAvailableGroups(groupsRes.data);
      }
    } catch {
      setAvailableGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    fetchData();
  }, []);

  const handleAcceptInvitation = async (invId: number, roomId?: string) => {
    setProcessingInvId(invId);
    try {
      const res = await apiClient.post(`/classrooms/invitations/${invId}/accept`);
      const targetRoomCode = res.data?.room_id || roomId;
      if (targetRoomCode) {
        router.push(`/classroom/${targetRoomCode}`);
      } else {
        fetchData();
      }
    } catch (err: any) {
      alert(extractErrorMessage(err, "Erreur lors de l'acceptation de l'invitation."));
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleDeclineInvitation = async (invId: number) => {
    setProcessingInvId(invId);
    try {
      await apiClient.post(`/classrooms/invitations/${invId}/decline`);
      setMyInvitations((prev) => prev.filter((i) => i.id !== invId));
    } catch (err: any) {
      alert(extractErrorMessage(err, "Erreur lors du refus de l'invitation."));
    } finally {
      setProcessingInvId(null);
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
        target_groups: selectedGroupIds.length > 0 ? selectedGroupIds.join(',') : undefined,
        is_private: isPrivate,
        auto_invitations: autoInvitations,
        allow_screen_sharing: allowScreenSharing,
        requires_approval: requiresApproval,
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

  const [stoppingRoomId, setStoppingRoomId] = useState<string | null>(null);

  const handleStopClassroom = async (roomId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir ARRÊTER cette classe virtuelle pour tous les participants ?")) return;
    setStoppingRoomId(roomId);
    try {
      await apiClient.post(`/classrooms/${roomId}/stop`);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de l'arrêt de la classe.");
    } finally {
      setStoppingRoomId(null);
    }
  };

  const isLearner = ['etudiant', 'étudiant', 'stagiaire', 'employer'].includes((currentUserRole || '').toLowerCase());
  const canCreateClass = !isLearner && ['admin', 'admin_manager', 'formateur', 'pedagogique', 'dg_rh', 'dg/rh'].includes((currentUserRole || '').toLowerCase());
  const canStopClassroom = !isLearner && ['admin', 'admin_manager', 'formateur', 'pedagogique', 'dg_rh', 'dg/rh'].includes((currentUserRole || '').toLowerCase());

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

      {/* Pending Invitations Section */}
      {myInvitations.length > 0 && (
        <div className="space-y-4 bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
            <Sparkles size={20} className="animate-bounce" />
            <span>Vos Invitations aux Classes Virtuelles ({myInvitations.length})</span>
          </div>
          <p className="text-xs text-text-secondary">
            Vous avez été invité(e) à participer à une classe virtuelle en direct. Choisissez d'accepter pour rejoindre le cours immédiatement ou de décliner.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {myInvitations.map((inv) => {
              const roomTitle = inv.classroom?.title || "Classe Virtuelle";
              const inviterName = inv.inviter?.email ? inv.inviter.email.split('@')[0] : `Formateur #${inv.inviter_id}`;
              const isProcessing = processingInvId === inv.id;

              return (
                <div key={inv.id} className="bg-surface p-4 rounded-xl border border-border flex flex-col justify-between gap-4 shadow-md">
                  <div>
                    <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                      <span className="font-semibold text-primary">Invitation Directe</span>
                      <span>{new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <h4 className="text-base font-bold text-text-primary">{roomTitle}</h4>
                    <p className="text-xs text-text-secondary mt-1">
                      Formateur hôte : <span className="font-medium text-text-primary">{inviterName}</span>
                    </p>
                    {inv.classroom?.room_id && (
                      <span className="inline-block mt-2 font-mono text-[11px] bg-surface-hover px-2 py-0.5 rounded text-text-secondary border border-border">
                        Code : {inv.classroom.room_id}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <button
                      onClick={() => handleAcceptInvitation(inv.id, inv.classroom?.room_id)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Accepter l'invitation
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(inv.id)}
                      disabled={isProcessing}
                      className="px-3.5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-1"
                    >
                      <Trash2 size={14} /> Décliner
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

                    <div className="flex gap-2">
                      <Link
                        href={`/classroom/${room.room_id}`}
                        className="flex-1 py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow text-xs sm:text-sm"
                      >
                        <Video size={16} /> Rejoindre la classe
                      </Link>
                      {canStopClassroom && (
                        <button
                          onClick={() => handleStopClassroom(room.room_id)}
                          disabled={stoppingRoomId === room.room_id}
                          className="px-3.5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0 text-xs cursor-pointer"
                          title="Arrêter la classe pour tous les participants"
                        >
                          {stoppingRoomId === room.room_id ? <Loader2 size={16} className="animate-spin" /> : <Square size={14} fill="currentColor" />}
                          <span className="hidden sm:inline">Arrêter</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Créer une Classe (Formateurs & Admin) */}
      {/* Create Room Modal - Light Mode UX Strict Rectangular Box */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white border-2 border-slate-300 shadow-2xl max-w-2xl w-full my-auto flex flex-col max-h-[88vh] relative animate-fade-in-up overflow-hidden rounded-none text-slate-900">
            
            {/* Modal Header - Rectangular Light Mode */}
            <div className="px-6 py-4 border-b-2 border-slate-200 flex items-center justify-between bg-white shrink-0 rounded-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 flex items-center justify-center font-bold rounded-none border border-blue-200">
                  <Video size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Nouvelle Classe Virtuelle</h3>
                  <p className="text-xs text-slate-500">Configurez et lancez une session en direct avec vos apprenants.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-600 hover:text-slate-900 w-8 h-8 bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-base font-bold transition-colors cursor-pointer rounded-none border border-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body (Scrollable Rectangular Sections - Light Mode) */}
            <form onSubmit={handleCreateRoom} className="flex-1 overflow-y-auto p-6 space-y-5 bg-white text-slate-900">
              {createError && (
                <div className="p-3.5 bg-red-50 border border-red-300 text-red-700 text-xs font-medium flex items-center gap-2 rounded-none">
                  <AlertCircle size={16} className="shrink-0 text-red-600" /> {createError}
                </div>
              )}

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Titre de la session *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Mathématiques - Intégrales & Algèbre"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm text-slate-900 placeholder:text-slate-400 rounded-none"
                />
              </div>

              {/* Description & Room Code Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Description / Ordre du jour (optionnel)
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Ex: Révision du chapitre 4 et exercices pratiques..."
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm text-slate-900 placeholder:text-slate-400 resize-y rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Code de salle personnalisé (optionnel)
                  </label>
                  <input
                    type="text"
                    value={customRoomId}
                    onChange={(e) => setCustomRoomId(e.target.value)}
                    placeholder="Laisser vide pour génération automatique (ex: abc-defg-hij)"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm font-mono text-slate-900 placeholder:text-slate-400 rounded-none"
                  />
                </div>
              </div>

              {/* Configuration Section */}
              <div className="pt-3 border-t-2 border-slate-200 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-900">
                  Configuration de la salle
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Salle Privée */}
                  <label className={`p-3.5 border flex items-center justify-between cursor-pointer transition-all rounded-none ${isPrivate ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 font-semibold' : 'bg-slate-50 border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                    <div className="space-y-0.5">
                      <span className="font-bold block text-slate-900">🔒 Salle privée</span>
                      <span className="text-[10px] text-slate-500">Accessibilité restreinte par défaut</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  {/* Invitations Automatiques */}
                  <label className={`p-3.5 border flex items-center justify-between cursor-pointer transition-all rounded-none ${autoInvitations ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 font-semibold' : 'bg-slate-50 border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                    <div className="space-y-0.5">
                      <span className="font-bold block text-slate-900">📩 Invitations automatiques</span>
                      <span className="text-[10px] text-slate-500">Notifier les groupes à la création</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoInvitations}
                      onChange={(e) => setAutoInvitations(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  {/* Partage d'écran */}
                  <label className={`p-3.5 border flex items-center justify-between cursor-pointer transition-all rounded-none ${allowScreenSharing ? 'bg-cyan-50 border-2 border-cyan-600 text-cyan-950 font-semibold' : 'bg-slate-50 border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                    <div className="space-y-0.5">
                      <span className="font-bold block text-slate-900">🖥️ Partage d'écran</span>
                      <span className="text-[10px] text-slate-500">Autoriser le partage d'écran</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowScreenSharing}
                      onChange={(e) => setAllowScreenSharing(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  {/* Salle d'attente */}
                  <label className={`p-3.5 border flex items-center justify-between cursor-pointer transition-all rounded-none ${requiresApproval ? 'bg-purple-50 border-2 border-purple-600 text-purple-950 font-semibold' : 'bg-slate-50 border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                    <div className="space-y-0.5">
                      <span className="font-bold block text-slate-900">🛡️ Salle d'attente (Approbation)</span>
                      <span className="text-[10px] text-slate-500">Approuver/Rejeter chaque participant</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={requiresApproval}
                      onChange={(e) => setRequiresApproval(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Group Invitations Section */}
              <div className="pt-3 border-t-2 border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 rounded-none">
                      <Users size={12} />
                    </div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-900">
                      Invitations aux groupes
                    </label>
                    <span className="text-[11px] text-slate-500 font-normal">
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
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors px-2 py-0.5 hover:bg-blue-50 self-start sm:self-auto cursor-pointer rounded-none border border-blue-200"
                    >
                      {selectedGroupIds.length === availableGroups.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  )}
                </div>

                {availableGroups.length === 0 ? (
                  <div className="p-3.5 border border-dashed border-slate-300 text-center text-xs text-slate-500 bg-slate-50 space-y-1 rounded-none">
                    <p className="font-semibold text-slate-800">Aucun groupe disponible</p>
                    <p>Créez des groupes dans le module <Link href="/group" className="text-blue-600 underline">Groupes & Promotions</Link> pour inviter vos apprenants.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
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
                          className={`p-3 border cursor-pointer transition-all flex items-start justify-between gap-2.5 select-none rounded-none ${
                            isSelected
                              ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 font-semibold shadow-sm'
                              : 'bg-slate-50 border border-slate-300 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {group.name}
                              </span>
                              {group.level && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold border border-blue-200 shrink-0 rounded-none">
                                  {group.level}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-600">
                              <Users size={12} className="shrink-0 text-blue-600" />
                              <span>{group.members_count || 0} apprenant{(group.members_count || 0) > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="accent-blue-600 w-4 h-4 mt-0.5 pointer-events-none shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer Actions (Fixed inside form bottom - Light Mode UX) */}
              <div className="pt-4 border-t-2 border-slate-200 flex items-center justify-end gap-3 shrink-0 bg-slate-50 p-4 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-white hover:bg-slate-100 text-xs font-bold border border-slate-300 text-slate-700 transition-colors cursor-pointer rounded-none"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer rounded-none"
                >
                  {isCreating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
                  <span>{isCreating ? 'Création...' : 'Lancer la Classe Virtuelle'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
