'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from '@/i18n/routing';
import { 
  Users, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  ShieldCheck, 
  GraduationCap, 
  Search, 
  X, 
  Layers, 
  UserCheck,
  AlertCircle,
  LayoutGrid,
  Maximize2,
  CheckSquare,
  Square,
  UserPlus,
  Mail,
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import GroupMembersModal from '@/components/group/GroupMembersModal';

interface Group {
  id: number;
  name: string;
  level: string | null;
  description: string | null;
  created_at: string;
  members_count: number;
}

interface GroupMemberDetail {
  id: number;
  group_id: number;
  user_id: number;
  joined_at: string;
  user_email: string;
  user_role: string;
  user_nom?: string | null;
  user_prenom?: string | null;
  user_username?: string | null;
  user_avatar?: string | null;
  user_departement?: string | null;
}

interface AvailableUser {
  id: number;
  email: string;
  role: string;
  nom?: string | null;
  prenom?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  departement?: string | null;
}

export default function GroupPage() {
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string } | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // View mode: 'panoramic' (wide master-detail) vs 'grid' (classic cards)
  const [viewMode, setViewMode] = useState<'panoramic' | 'grid'>('panoramic');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  
  // Panoramic detail state
  const [panoramicMembers, setPanoramicMembers] = useState<GroupMemberDetail[]>([]);
  const [isLoadingPanoramicMembers, setIsLoadingPanoramicMembers] = useState(false);
  const [panoramicMemberSearch, setPanoramicMemberSearch] = useState('');
  const [panoramicRoleFilter, setPanoramicRoleFilter] = useState<'all' | 'étudiant' | 'stagiaire' | 'employer'>('all');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [managingGroupId, setManagingGroupId] = useState<{ id: number; name: string } | null>(null);
  
  // Creation / Edit Form State
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Available users for creation member picker
  const [availableUsersForCreation, setAvailableUsersForCreation] = useState<AvailableUser[]>([]);
  const [selectedCreationMemberIds, setSelectedCreationMemberIds] = useState<number[]>([]);
  const [creationUserSearch, setCreationUserSearch] = useState('');
  const [isLoadingCreationUsers, setIsLoadingCreationUsers] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await apiClient.get('/groups/');
      setGroups(res.data);
      // Auto-select first group if none is selected
      if (res.data.length > 0) {
        setSelectedGroupId(prev => {
          if (prev && res.data.some((g: Group) => g.id === prev)) return prev;
          return res.data[0].id;
        });
      } else {
        setSelectedGroupId(null);
      }
    } catch (err) {
      console.error('Erreur chargement des groupes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPanoramicMembers = useCallback(async (groupId: number) => {
    setIsLoadingPanoramicMembers(true);
    try {
      const res = await apiClient.get(`/groups/${groupId}/members`);
      setPanoramicMembers(res.data);
    } catch (err) {
      console.error('Erreur chargement membres panoramique:', err);
    } finally {
      setIsLoadingPanoramicMembers(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchPanoramicMembers(selectedGroupId);
    } else {
      setPanoramicMembers([]);
    }
  }, [selectedGroupId, fetchPanoramicMembers]);

  useEffect(() => {
    // Restore preferred view mode
    const savedMode = localStorage.getItem('eschola_group_view_mode') as 'panoramic' | 'grid' | null;
    if (savedMode) {
      setViewMode(savedMode);
    }

    const initPage = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      let userRole = '';
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userRole = String(payload.role || '').toLowerCase();
        setCurrentUser({ id: payload.sub, email: payload.email, role: userRole });
      } catch {
        // Token parsing fallback
      }

      try {
        const userRes = await apiClient.get('/users/me');
        if (userRes.data) {
          userRole = String(userRes.data.role || '').toLowerCase();
          setCurrentUser(userRes.data);
        }
      } catch {
        // User fetch fallback
      }

      // If learner, do not fetch groups
      if (['etudiant', 'étudiant', 'stagiaire', 'employer'].includes(userRole)) {
        setIsLoading(false);
        return;
      }

      fetchGroups();
    };

    initPage();
  }, []);

  const handleToggleViewMode = (mode: 'panoramic' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('eschola_group_view_mode', mode);
  };

  const canManage = ['admin', 'admin_manager', 'formateur', 'pedagogique', 'dg_rh', 'dg/rh'].includes(
    (currentUser?.role || '').trim().toLowerCase()
  );

  const handleOpenAdd = async () => {
    setEditingGroupId(null);
    setNewName('');
    setNewLevel('');
    setNewDescription('');
    setFormError('');
    setSelectedCreationMemberIds([]);
    setCreationUserSearch('');
    setShowFormModal(true);

    // Fetch available users for creation picker
    setIsLoadingCreationUsers(true);
    try {
      const res = await apiClient.get('/groups/available-users/');
      setAvailableUsersForCreation(res.data);
    } catch (err) {
      console.error("Erreur chargement apprenants:", err);
    } finally {
      setIsLoadingCreationUsers(false);
    }
  };

  const handleOpenEdit = (g: Group) => {
    setEditingGroupId(g.id);
    setNewName(g.name);
    setNewLevel(g.level || '');
    setNewDescription(g.description || '');
    setFormError('');
    setSelectedCreationMemberIds([]);
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setFormError("Le nom du groupe / classe est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const payload: any = {
        name: trimmedName,
        level: newLevel.trim() || null,
        description: newDescription.trim() || null
      };

      if (!editingGroupId && selectedCreationMemberIds.length > 0) {
        payload.member_ids = selectedCreationMemberIds;
      }
      
      if (editingGroupId) {
        await apiClient.put(`/groups/${editingGroupId}`, payload);
      } else {
        const createRes = await apiClient.post('/groups/', payload);
        if (createRes.data?.id) {
          setSelectedGroupId(createRes.data.id);
        }
      }
      
      setShowFormModal(false);
      setFormError('');
      await fetchGroups();
      if (editingGroupId && selectedGroupId === editingGroupId) {
        fetchPanoramicMembers(editingGroupId);
      }
    } catch (err: any) {
      console.error("Erreur sauvegarde groupe:", err);
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        setFormError(detail);
      } else if (Array.isArray(detail)) {
        setFormError(detail.map((d: any) => d.msg || d.message).join(', '));
      } else if (err?.response?.status === 401) {
        setFormError("Session expirée. Veuillez vous reconnecter.");
      } else if (err?.response?.status === 403) {
        setFormError("Accès refusé : vos droits ne permettent pas de créer ou modifier un groupe.");
      } else if (err?.response?.status === 400 && typeof err?.response?.data === 'string') {
        setFormError(err.response.data);
      } else {
        setFormError(err?.message || "Erreur lors de la sauvegarde du groupe.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce groupe définitivement ? Tous les membres seront retirés.")) return;
    try {
      await apiClient.delete(`/groups/${id}`);
      setGroups(prev => prev.filter(g => g.id !== id));
      if (selectedGroupId === id) {
        const remaining = groups.filter(g => g.id !== id);
        setSelectedGroupId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la suppression.");
    }
  };

  const handleRemoveMemberFromPanoramic = async (userId: number, userName: string) => {
    if (!selectedGroupId) return;
    if (!confirm(`Voulez-vous vraiment retirer "${userName}" de ce groupe ?`)) return;
    try {
      await apiClient.delete(`/groups/${selectedGroupId}/members/${userId}`);
      await fetchPanoramicMembers(selectedGroupId);
      await fetchGroups();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors du retrait du membre.");
    }
  };

  // Filtered groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase().trim();
    return groups.filter(g => 
      g.name.toLowerCase().includes(query) ||
      (g.level && g.level.toLowerCase().includes(query)) ||
      (g.description && g.description.toLowerCase().includes(query))
    );
  }, [groups, searchQuery]);

  // Aggregate stats
  const totalMembers = useMemo(() => {
    return groups.reduce((acc, g) => acc + (g.members_count || 0), 0);
  }, [groups]);

  // Selected Group in Panoramic mode
  const selectedGroup = useMemo(() => {
    return groups.find(g => g.id === selectedGroupId) || null;
  }, [groups, selectedGroupId]);

  // Filtered panoramic members
  const filteredPanoramicMembers = useMemo(() => {
    return panoramicMembers.filter(m => {
      // Role filter
      if (panoramicRoleFilter !== 'all') {
        const r = (m.user_role || '').toLowerCase();
        if (panoramicRoleFilter === 'étudiant' && !(r.includes('etudiant') || r.includes('étudiant'))) return false;
        if (panoramicRoleFilter === 'stagiaire' && !r.includes('stagiaire')) return false;
        if (panoramicRoleFilter === 'employer' && !r.includes('employer')) return false;
      }
      // Search filter
      if (!panoramicMemberSearch.trim()) return true;
      const q = panoramicMemberSearch.toLowerCase().trim();
      const name = `${m.user_prenom || ''} ${m.user_nom || ''} ${m.user_username || ''}`.toLowerCase();
      return (
        name.includes(q) ||
        m.user_email.toLowerCase().includes(q) ||
        (m.user_departement && m.user_departement.toLowerCase().includes(q))
      );
    });
  }, [panoramicMembers, panoramicMemberSearch, panoramicRoleFilter]);

  // Filtered available users for creation picker
  const filteredCreationUsers = useMemo(() => {
    if (!creationUserSearch.trim()) return availableUsersForCreation;
    const q = creationUserSearch.toLowerCase().trim();
    return availableUsersForCreation.filter(u => {
      const name = `${u.prenom || ''} ${u.nom || ''} ${u.username || ''}`.toLowerCase();
      return (
        name.includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [availableUsersForCreation, creationUserSearch]);

  const handleToggleCreationMember = (id: number) => {
    setSelectedCreationMemberIds(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllCreation = () => {
    const visibleIds = filteredCreationUsers.map(u => u.id);
    const allSelected = visibleIds.every(id => selectedCreationMemberIds.includes(id));
    if (allSelected) {
      setSelectedCreationMemberIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedCreationMemberIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const getUserDisplayName = (u: { nom?: string | null; prenom?: string | null; username?: string | null; email?: string | null }) => {
    if (u.prenom || u.nom) {
      return `${u.prenom || ''} ${u.nom || ''}`.trim();
    }
    if (u.username) return u.username;
    return u.email || 'Utilisateur';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <Loader2 size={36} className="animate-spin text-[#1877f2]" />
      </div>
    );
  }

  const userRole = (currentUser?.role || '').trim().toLowerCase();
  const isLearner = ['etudiant', 'étudiant', 'stagiaire', 'employer'].includes(userRole);

  if (!isLoading && isLearner) {
    return (
      <div className="min-h-screen pt-28 pb-16 flex flex-col items-center justify-center text-center px-4 space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-xs">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Accès Réservé</h2>
        <p className="text-slate-600 text-sm max-w-md leading-relaxed">
          Ce module est réservé aux formateurs, aux responsables pédagogiques et à la direction DG/RH. Vos affectations de groupes sont gérées automatiquement.
        </p>
        <Link href="/dashboard" className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 max-w-[1700px] mx-auto space-y-6 animate-fade-in-up">
      
      {/* 1. HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 border border-blue-200/60 text-[#1877f2] flex items-center justify-center shrink-0 shadow-xs">
            <Users size={28} className="sm:size-[32px]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Groupes & Classes
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-[#1877f2] border border-blue-200">
                <Sparkles size={13} />
                <span>Panoramique &amp; Affectation Directe</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Gérez les classes, organisez les promotions et affectez les étudiants dès la création ou au groupe existant.
            </p>
          </div>
        </div>

        {/* Action button */}
        {canManage && (
          <button
            onClick={handleOpenAdd}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus size={18} />
            <span>Créer un groupe</span>
          </button>
        )}
      </div>

      {/* 2. STATS, RECHERCHE & SÉLECTEUR DE VUE */}
      {groups.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 p-3.5 rounded-2xl border border-slate-200 shadow-2xs backdrop-blur-xs">
          
          {/* Stats Chips */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
              <Layers size={15} className="text-[#1877f2]" />
              <span>{groups.length} Classe{groups.length > 1 ? 's' : ''} / Promotion{groups.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
              <UserCheck size={15} className="text-emerald-600" />
              <span>{totalMembers} Apprenant{totalMembers > 1 ? 's' : ''} affecté{totalMembers > 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end flex-wrap">
            {/* Search Box */}
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une classe..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-xs text-slate-900 font-medium placeholder:text-slate-400 shadow-2xs outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="Effacer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleToggleViewMode('panoramic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'panoramic'
                    ? 'bg-white text-[#1877f2] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Affichage Panoramique (Split-Screen étendu)"
              >
                <Maximize2 size={14} />
                <span>Panoramique</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#1877f2] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Affichage en Grille"
              >
                <LayoutGrid size={14} />
                <span>Grille</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 3. CONTENU PRINCIPAL SELON LE MODE */}
      {groups.length === 0 ? (
        /* Empty State Global */
        <div className="bg-white p-10 sm:p-14 text-center rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center max-w-xl mx-auto space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1877f2] shadow-xs mb-2">
            <GraduationCap size={34} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Aucun groupe créé pour le moment
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md">
            Créez votre première classe ou promotion. Vous pourrez sélectionner et affecter des apprenants dès la création.
          </p>
          {canManage && (
            <div className="pt-3">
              <button
                onClick={handleOpenAdd}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={18} />
                <span>Créer un premier groupe avec apprenants</span>
              </button>
            </div>
          )}
        </div>
      ) : filteredGroups.length === 0 ? (
        /* Empty State Recherche */
        <div className="bg-white p-10 text-center rounded-3xl border border-slate-200 shadow-xs max-w-md mx-auto space-y-3">
          <p className="text-base font-bold text-slate-900">
            Aucun groupe trouvé pour « {searchQuery} »
          </p>
          <p className="text-xs text-slate-500">
            Vérifiez l&apos;orthographe ou réinitialisez le filtre.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-bold text-[#1877f2] hover:underline pt-2 cursor-pointer"
          >
            Réinitialiser la recherche
          </button>
        </div>
      ) : viewMode === 'panoramic' ? (
        
        /* ═══════════════════════════════════════════════════════════════ */
        /* MODE PANORAMIQUE (MASTER-DETAIL WORKSPACE ÉTENDU)               */
        /* ═══════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* A. COLONNE GAUCHE (MASTER LIST DES GROUPES) ~ 4 cols */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-3 bg-white p-4 rounded-3xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 px-1">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-[#1877f2]" />
                <span>Promotions ({filteredGroups.length})</span>
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="p-1 text-[#1877f2] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Nouveau groupe"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredGroups.map(group => {
                const isSelected = selectedGroupId === group.id;
                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 shadow-xs ring-1 ring-blue-300/60'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-extrabold truncate ${isSelected ? 'text-[#1877f2]' : 'text-slate-900'}`}>
                          {group.name}
                        </p>
                        {group.level && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                            {group.level}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={16} className={`shrink-0 transition-transform ${isSelected ? 'text-[#1877f2] translate-x-1' : 'text-slate-300'}`} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Users size={12} className={isSelected ? 'text-[#1877f2]' : 'text-slate-400'} />
                        <span>{group.members_count} membre{group.members_count > 1 ? 's' : ''}</span>
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {new Date(group.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* B. ESPACE PANORAMIQUE DROITE (DETAIL & WORKSPACE DES MEMBRES) ~ 8-9 cols */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            {selectedGroup ? (
              <>
                {/* HERO BANNER DE LA CLASSE SÉLECTIONNÉE */}
                <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight truncate max-w-xl" title={selectedGroup.name}>
                          {selectedGroup.name}
                        </h2>
                        {selectedGroup.level ? (
                          <span className="px-3 py-0.5 rounded-full text-xs font-black bg-blue-50 text-[#1877f2] border border-blue-200 tracking-wide uppercase">
                            {selectedGroup.level}
                          </span>
                        ) : (
                          <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            Niveau non spécifié
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                        {selectedGroup.description || "Aucune description fournie pour cette promotion."}
                      </p>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(selectedGroup)}
                          className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Pencil size={14} className="text-slate-500" />
                          <span>Modifier</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(selectedGroup.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                          title="Supprimer la classe"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* MINI KPI ROW */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Total Apprenants</p>
                      <p className="text-xl font-black text-slate-900 mt-0.5">{panoramicMembers.length}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Étudiants</p>
                      <p className="text-xl font-black text-blue-600 mt-0.5">
                        {panoramicMembers.filter(m => (m.user_role || '').toLowerCase().includes('etudiant') || (m.user_role || '').toLowerCase().includes('étudiant')).length}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Stagiaires</p>
                      <p className="text-xl font-black text-amber-600 mt-0.5">
                        {panoramicMembers.filter(m => (m.user_role || '').toLowerCase().includes('stagiaire')).length}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Salariés / Employés</p>
                      <p className="text-xl font-black text-emerald-600 mt-0.5">
                        {panoramicMembers.filter(m => (m.user_role || '').toLowerCase().includes('employer')).length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* TABLEAU PANORAMIQUE DES MEMBRES */}
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-4 p-6">
                  
                  {/* BARRE D'ACTIONS MEMBRES */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Users size={18} className="text-[#1877f2]" />
                        <span>Membres de la classe ({panoramicMembers.length})</span>
                      </h3>
                      {/* Role filter buttons */}
                      <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                        {(['all', 'étudiant', 'stagiaire', 'employer'] as const).map(role => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setPanoramicRoleFilter(role)}
                            className={`px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                              panoramicRoleFilter === role
                                ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {role === 'all' ? 'Tous' : role}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Search inside members */}
                      <div className="relative w-full sm:w-56">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={panoramicMemberSearch}
                          onChange={(e) => setPanoramicMemberSearch(e.target.value)}
                          placeholder="Filtrer apprenant..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1877f2]"
                        />
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setManagingGroupId({ id: selectedGroup.id, name: selectedGroup.name })}
                          className="btn-primary px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <UserPlus size={15} />
                          <span>Ajouter des membres</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TABLEAU DES MEMBRES */}
                  {isLoadingPanoramicMembers ? (
                    <div className="py-16 flex items-center justify-center">
                      <Loader2 size={32} className="animate-spin text-[#1877f2]" />
                    </div>
                  ) : panoramicMembers.length === 0 ? (
                    <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                      <Users size={32} className="mx-auto text-slate-400" />
                      <p className="text-sm font-bold text-slate-800">Aucun apprenant dans ce groupe pour l&apos;instant</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Affectez des étudiants, stagiaires ou employés pour commencer le suivi pédagogique.
                      </p>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setManagingGroupId({ id: selectedGroup.id, name: selectedGroup.name })}
                          className="btn-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <UserPlus size={15} />
                          <span>Affecter des apprenants maintenant</span>
                        </button>
                      )}
                    </div>
                  ) : filteredPanoramicMembers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Aucun membre ne correspond à vos filtres actuels.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                            <th className="py-3 px-4">Apprenant</th>
                            <th className="py-3 px-4">Email</th>
                            <th className="py-3 px-4">Rôle Institutionnel</th>
                            <th className="py-3 px-4">Spécialisation / Dépt</th>
                            <th className="py-3 px-4">Affecté le</th>
                            {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPanoramicMembers.map(member => {
                            const displayName = getUserDisplayName({
                              nom: member.user_nom,
                              prenom: member.user_prenom,
                              username: member.user_username,
                              email: member.user_email
                            });
                            const initial = (displayName.charAt(0) || 'U').toUpperCase();
                            return (
                              <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    {member.user_avatar ? (
                                      <img 
                                        src={member.user_avatar} 
                                        alt={displayName} 
                                        className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" 
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 text-[#1877f2] flex items-center justify-center text-xs font-black shrink-0">
                                        {initial}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 truncate">{displayName}</p>
                                      {member.user_username && (
                                        <p className="text-[10px] text-slate-400 truncate">@{member.user_username}</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-medium text-slate-600">
                                  <a href={`mailto:${member.user_email}`} className="hover:text-[#1877f2] flex items-center gap-1">
                                    <Mail size={12} className="text-slate-400" />
                                    <span>{member.user_email}</span>
                                  </a>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1877f2] border border-blue-200">
                                    {member.user_role}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500 font-medium">
                                  {member.user_departement || '—'}
                                </td>
                                <td className="py-3 px-4 text-slate-500 font-medium">
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <Calendar size={12} className="text-slate-400" />
                                    <span>{new Date(member.joined_at).toLocaleDateString('fr-FR')}</span>
                                  </div>
                                </td>
                                {canManage && (
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMemberFromPanoramic(member.user_id, displayName)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Retirer ce membre du groupe"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              </>
            ) : (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-500 text-sm">
                Sélectionnez une classe dans le panneau de gauche pour afficher les détails et ses membres.
              </div>
            )}
          </div>

        </div>

      ) : (

        /* ═══════════════════════════════════════════════════════════════ */
        /* MODE GRILLE (CARTES RESPONSIVES CLASSIQUES)                     */
        /* ═══════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map(group => (
            <div 
              key={group.id} 
              className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-xs"
            >
              <div className="p-6 flex-1 space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#1877f2] transition-colors truncate" title={group.name}>
                      {group.name}
                    </h3>
                    {group.level ? (
                      <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-[#1877f2] border border-blue-200/70 tracking-wide uppercase">
                        {group.level}
                      </span>
                    ) : (
                      <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                        Niveau non spécifié
                      </span>
                    )}
                  </div>
                  
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleOpenEdit(group)} 
                        className="p-1.5 text-slate-400 hover:text-[#1877f2] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Modifier les détails"
                      >
                        <Pencil size={15} />
                      </button>
                      <button 
                        onClick={() => handleDelete(group.id)} 
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer ce groupe"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3 min-h-[2.75rem]">
                  {group.description || "Aucune description fournie pour ce groupe."}
                </p>
              </div>

              <div className="bg-slate-50/80 px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <Users size={15} className="text-[#1877f2]" />
                  <span>{group.members_count} membre{group.members_count > 1 ? 's' : ''}</span>
                </div>
                
                {canManage && (
                  <button
                    onClick={() => setManagingGroupId({ id: group.id, name: group.name })}
                    className="btn-primary px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Gérer les membres</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. MODAL AJOUTER / MODIFIER UN GROUPE (AVEC SÉLECTEUR DE MEMBRES DÈS LA CRÉATION) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xl space-y-5 animate-zoom-in text-slate-900 max-h-[92vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 text-[#1877f2] flex items-center justify-center font-bold shrink-0">
                  <Users size={18} />
                </div>
                <span>{editingGroupId ? "Modifier le groupe" : "Créer un nouveau groupe"}</span>
              </h3>
              <button 
                onClick={() => { setShowFormModal(false); setFormError(''); }}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl font-semibold text-xs flex items-center gap-2 shrink-0">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  NOM DU GROUPE / CLASSE <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex : classe 1, Master 1 - IA, Promotion 2026..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-xs text-slate-900 font-medium placeholder:text-slate-400 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  NIVEAU ACADÉMIQUE (OPTIONNEL)
                </label>
                <input
                  type="text"
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value)}
                  placeholder="Ex : Débutant, M1, L3, Année 2..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-xs text-slate-900 font-medium placeholder:text-slate-400 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  DESCRIPTION DÉTAILLÉE (OPTIONNEL)
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Objectifs de la classe, cours ou précisions..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-xs text-slate-900 font-medium placeholder:text-slate-400 transition-all outline-none resize-none"
                />
              </div>

              {/* SECTION D'AFFECTATION DE MEMBRES DÈS LA CRÉATION */}
              {!editingGroupId && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <UserPlus size={14} className="text-[#1877f2]" />
                      <span>Affecter des membres dès la création</span>
                    </label>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {selectedCreationMemberIds.length} sélectionné{selectedCreationMemberIds.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {isLoadingCreationUsers ? (
                    <div className="py-4 text-center">
                      <Loader2 size={20} className="animate-spin text-[#1877f2] mx-auto" />
                    </div>
                  ) : availableUsersForCreation.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-1">
                      Aucun apprenant disponible actuellement. Vous pourrez en affecter plus tard.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={creationUserSearch}
                            onChange={(e) => setCreationUserSearch(e.target.value)}
                            placeholder="Rechercher par nom ou email..."
                            className="w-full pl-7 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#1877f2]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleSelectAllCreation}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer shrink-0"
                        >
                          {filteredCreationUsers.every(u => selectedCreationMemberIds.includes(u.id)) ? "Désélectionner tout" : "Tout sélectionner"}
                        </button>
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-200/80 rounded-xl p-1.5 bg-white">
                        {filteredCreationUsers.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-2">Aucun utilisateur trouvé.</p>
                        ) : (
                          filteredCreationUsers.map(u => {
                            const isChecked = selectedCreationMemberIds.includes(u.id);
                            const displayName = getUserDisplayName(u);
                            return (
                              <div
                                key={u.id}
                                onClick={() => handleToggleCreationMember(u.id)}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                  isChecked ? 'bg-blue-50/90 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isChecked ? (
                                    <CheckSquare size={15} className="text-[#1877f2] shrink-0" />
                                  ) : (
                                    <Square size={15} className="text-slate-400 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">{displayName}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                                  </div>
                                </div>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                  {u.role}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowFormModal(false); setFormError(''); }}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 text-xs transition-colors cursor-pointer border border-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 btn-primary py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Enregistrer</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DE GESTION DES MEMBRES (AVEC AJOUT MULTIPLE / PAR LOT) */}
      {managingGroupId && (
        <GroupMembersModal
          groupId={managingGroupId.id}
          groupName={managingGroupId.name}
          onClose={() => {
            setManagingGroupId(null);
            fetchGroups();
            if (selectedGroupId === managingGroupId.id) {
              fetchPanoramicMembers(managingGroupId.id);
            }
          }}
        />
      )}

    </div>
  );
}
