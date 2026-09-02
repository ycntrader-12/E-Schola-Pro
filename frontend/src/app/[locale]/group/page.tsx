'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { Users, Plus, Pencil, Trash2, Loader2, ShieldCheck, GraduationCap } from 'lucide-react';
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
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [managingGroupId, setManagingGroupId] = useState<{ id: number; name: string } | null>(null);
  
  // Form State
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      } catch (e) {}

      try {
        const userRes = await apiClient.get('/users/me');
        if (userRes.data) {
          userRole = String(userRes.data.role || '').toLowerCase();
          setCurrentUser(userRes.data);
        }
      } catch (err) {}

      // If learner, do not fetch groups
      if (['etudiant', 'étudiant', 'stagiaire', 'employer'].includes(userRole)) {
        setIsLoading(false);
        return;
      }

      fetchGroups();
    };

    initPage();
  }, []);

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

  const canManage = ['admin', 'admin_manager', 'admin_limited', 'formateur', 'pedagogique'].includes(
    (currentUser?.role || '').trim().toLowerCase()
  );

  const handleOpenAdd = () => {
    setEditingGroupId(null);
    setNewName('');
    setNewLevel('');
    setNewDescription('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (g: Group) => {
    setEditingGroupId(g.id);
    setNewName(g.name);
    setNewLevel(g.level || '');
    setNewDescription(g.description || '');
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: newName,
        level: newLevel || null,
        description: newDescription || null
      };
      
      if (editingGroupId) {
        await apiClient.put(`/groups/${editingGroupId}`, payload);
      } else {
        await apiClient.post('/groups', payload);
      }
      
      setShowFormModal(false);
      await fetchGroups();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la sauvegarde.");
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const userRole = (currentUser?.role || '').trim().toLowerCase();
  const isLearner = ['etudiant', 'étudiant', 'stagiaire', 'employer'].includes(userRole);

  if (!isLoading && isLearner) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center shadow-lg">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">Accès Non Autorisé</h2>
        <p className="text-text-secondary text-sm max-w-md">
          Ce module est strictement réservé aux formateurs et à l&apos;administration. Les rôles apprenants (étudiants, stagiaires, employés) ne sont pas autorisés à accéder aux groupes ni à les afficher.
        </p>
        <Link href="/dashboard" className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-8 lg:py-12 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Users size={36} className="text-primary" />
            Groupes & Classes
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            Gérez les classes, les niveaux et affectez les étudiants à leurs groupes respectifs.
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleOpenAdd}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/25"
          >
            <Plus size={18} /> Créer un groupe
          </button>
        )}
      </div>

      {/* GROUPS GRID */}
      {groups.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-border">
          <GraduationCap size={48} className="text-border mx-auto mb-4" />
          <p className="text-lg font-bold text-text-secondary">Aucun groupe créé pour le moment</p>
          {canManage && <p className="text-sm text-text-secondary mt-1">Commencez par créer une classe ou un niveau.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <div key={group.id} className="glass-card rounded-2xl border border-border hover:border-primary/40 transition-all flex flex-col overflow-hidden group">
              
              <div className="p-5 flex-1 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                      {group.name}
                    </h3>
                    {group.level && (
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary uppercase tracking-wider mt-2 border border-primary/20">
                        {group.level}
                      </span>
                    )}
                  </div>
                  
                  {canManage && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenEdit(group)} className="p-1.5 text-text-secondary hover:text-primary rounded-lg hover:bg-primary/10">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(group.id)} className="p-1.5 text-text-secondary hover:text-rose-400 rounded-lg hover:bg-rose-500/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-text-secondary line-clamp-3">
                  {group.description || "Aucune description fournie pour ce groupe."}
                </p>
              </div>

              <div className="bg-surface/50 p-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-text-secondary">
                  <Users size={16} />
                  {group.members_count} membre{group.members_count > 1 ? 's' : ''}
                </div>
                
                {canManage && (
                  <button
                    onClick={() => setManagingGroupId({ id: group.id, name: group.name })}
                    className="text-xs font-bold text-primary hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 hover:bg-primary hover:border-primary"
                  >
                    Gérer
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* FORM MODAL (Add/Edit) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-primary/30 space-y-6 animate-fade-in-up">
            
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {editingGroupId ? "Modifier le groupe" : "Créer un groupe"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Nom du groupe *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Groupe A, Classe 1, Dev Web..."
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-white focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Niveau (Optionnel)</label>
                <input
                  type="text"
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value)}
                  placeholder="Ex: Master 1, L3, Débutant..."
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-white focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Description (Optionnel)</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-white focus:border-primary outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 py-2.5 bg-surface hover:bg-surface-hover rounded-xl font-bold border border-border text-text-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn-primary py-2.5 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEMBERS MANAGEMENT MODAL */}
      {managingGroupId && (
        <GroupMembersModal
          groupId={managingGroupId.id}
          groupName={managingGroupId.name}
          onClose={() => {
            setManagingGroupId(null);
            fetchGroups(); // Refresh counts
          }}
        />
      )}

    </div>
  );
}
