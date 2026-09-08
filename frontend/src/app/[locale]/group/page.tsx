'use client';

import { useState, useEffect, useMemo } from 'react';
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
  AlertCircle 
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

export default function GroupPage() {
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string } | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [managingGroupId, setManagingGroupId] = useState<{ id: number; name: string } | null>(null);
  
  // Form State
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await apiClient.get('/groups');
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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

  const canManage = ['admin', 'admin_manager', 'formateur', 'pedagogique'].includes(
    (currentUser?.role || '').trim().toLowerCase()
  );

  const handleOpenAdd = () => {
    setEditingGroupId(null);
    setNewName('');
    setNewLevel('');
    setNewDescription('');
    setFormError('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (g: Group) => {
    setEditingGroupId(g.id);
    setNewName(g.name);
    setNewLevel(g.level || '');
    setNewDescription(g.description || '');
    setFormError('');
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
      const payload = {
        name: trimmedName,
        level: newLevel.trim() || null,
        description: newDescription.trim() || null
      };
      
      if (editingGroupId) {
        await apiClient.put(`/groups/${editingGroupId}`, payload);
      } else {
        await apiClient.post('/groups', payload);
      }
      
      setShowFormModal(false);
      setFormError('');
      await fetchGroups();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || "Erreur lors de la sauvegarde du groupe.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce groupe définitivement ? Tous les membres seront retirés.")) return;
    try {
      await apiClient.delete(`/groups/${id}`);
      setGroups(prev => prev.filter(g => g.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la suppression.");
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
          Ce module est réservé aux formateurs et à l&apos;administration pédagogique. Vos affectations de groupes sont gérées automatiquement par votre établissement.
        </p>
        <Link href="/dashboard" className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 pt-24 sm:pt-28 pb-16 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      
      {/* 1. HEADER CARD (Haute lisibilité avec marge sous Navbar fixe) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 border border-blue-200/60 text-[#1877f2] flex items-center justify-center shrink-0 shadow-xs">
            <Users size={28} className="sm:size-[32px]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Groupes & Classes
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Gérez les classes, organisez les promotions et affectez les étudiants à leurs groupes respectifs.
            </p>
          </div>
        </div>

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

      {/* 2. STATS & RECHERCHE (Barre de contrôle lisible) */}
      {groups.length > 0 && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Stats Chips */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-xl border border-slate-200/80 text-xs font-bold text-slate-700 shadow-2xs">
              <Layers size={16} className="text-[#1877f2]" />
              <span>{groups.length} Classe{groups.length > 1 ? 's' : ''} / Groupe{groups.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-xl border border-slate-200/80 text-xs font-bold text-slate-700 shadow-2xs">
              <UserCheck size={16} className="text-emerald-600" />
              <span>{totalMembers} Apprenant{totalMembers > 1 ? 's' : ''} affecté{totalMembers > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, niveau ou mot-clé..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 font-medium placeholder:text-slate-400 shadow-2xs outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Effacer la recherche"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. CONTENU PRINCIPAL (EMPTY STATE OU GRILLE) */}
      {groups.length === 0 ? (
        /* Empty State Global (Aucun groupe dans la base) */
        <div className="bg-white p-10 sm:p-14 text-center rounded-3xl border border-slate-200/90 shadow-sm flex flex-col items-center max-w-xl mx-auto space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#1877f2] shadow-xs mb-2">
            <GraduationCap size={34} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Aucun groupe créé pour le moment
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md">
            Commencez par créer une classe ou une promotion pour regrouper vos apprenants et simplifier le suivi pédagogique.
          </p>
          {canManage && (
            <div className="pt-3">
              <button
                onClick={handleOpenAdd}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={18} />
                <span>Créer un premier groupe</span>
              </button>
            </div>
          )}
        </div>
      ) : filteredGroups.length === 0 ? (
        /* Empty State Recherche (Aucun groupe correspondant) */
        <div className="bg-white p-10 text-center rounded-3xl border border-slate-200 shadow-xs max-w-md mx-auto space-y-3">
          <p className="text-base font-bold text-slate-900">
            Aucun groupe trouvé pour « {searchQuery} »
          </p>
          <p className="text-xs text-slate-500">
            Vérifiez l&apos;orthographe ou tentez une autre recherche.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-bold text-[#1877f2] hover:underline pt-2 cursor-pointer"
          >
            Réinitialiser la recherche
          </button>
        </div>
      ) : (
        /* Grille des Groupes */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map(group => (
            <div 
              key={group.id} 
              className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-xs"
            >
              
              {/* Corps de la carte */}
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
                        title="Modifier les détails du groupe"
                        aria-label="Modifier"
                      >
                        <Pencil size={15} />
                      </button>
                      <button 
                        onClick={() => handleDelete(group.id)} 
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer ce groupe"
                        aria-label="Supprimer"
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

              {/* Pied de carte avec effectif et bouton d'affectation */}
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

      {/* 4. MODAL AJOUTER / MODIFIER UN GROUPE */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xl space-y-5 animate-zoom-in text-slate-900">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
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
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl font-semibold text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  NOM DU GROUPE / CLASSE <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex : Master 1 - Informatique, Groupe B, Promotion 2026..."
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
                  placeholder="Ex : M1, L3, Débutant, Avancé, Année 2..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-xs text-slate-900 font-medium placeholder:text-slate-400 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  DESCRIPTION DÉTAILLÉE (OPTIONNEL)
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Objectifs de la classe, spécialité ou détails utiles pour l'affectation..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-xs text-slate-900 font-medium placeholder:text-slate-400 transition-all outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
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

      {/* 5. MODAL DE GESTION DES MEMBRES */}
      {managingGroupId && (
        <GroupMembersModal
          groupId={managingGroupId.id}
          groupName={managingGroupId.name}
          onClose={() => {
            setManagingGroupId(null);
            fetchGroups(); // Rafraîchissement des effectifs
          }}
        />
      )}

    </div>
  );
}
