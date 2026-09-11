'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Loader2, 
  Users, 
  UserCheck, 
  Search, 
  CheckSquare, 
  Square,
  AlertCircle,
  UserPlus
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface GroupMembersModalProps {
  groupId: number;
  groupName: string;
  onClose: () => void;
}

interface Member {
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

export default function GroupMembersModal({ groupId, groupName, onClose }: GroupMembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Selection mode for batch adding
  const [batchMode, setBatchMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [singleUserId, setSingleUserId] = useState<number | ''>('');
  
  // Filters & search
  const [memberSearch, setMemberSearch] = useState('');
  const [availSearch, setAvailSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchMembers = async () => {
    try {
      const res = await apiClient.get(`/groups/${groupId}/members`);
      setMembers(res.data);
    } catch (err) {
      console.error('Erreur chargement membres:', err);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const res = await apiClient.get(`/groups/available-users?group_id=${groupId}`);
      setAvailableUsers(res.data);
    } catch (err) {
      console.error('Erreur chargement apprenants disponibles:', err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([fetchMembers(), fetchAvailableUsers()]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [groupId]);

  // Handle single addition
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleUserId) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsAdding(true);
    try {
      await apiClient.post(`/groups/${groupId}/members`, { user_id: Number(singleUserId) });
      setSingleUserId('');
      setSuccessMessage("Membre ajouté avec succès au groupe.");
      await loadData();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || "Erreur lors de l'ajout.");
    } finally {
      setIsAdding(false);
    }
  };

  // Handle batch addition
  const handleAddBatch = async () => {
    if (selectedUserIds.length === 0) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsAdding(true);
    try {
      const res = await apiClient.post(`/groups/${groupId}/members/batch`, { user_ids: selectedUserIds });
      setSelectedUserIds([]);
      setBatchMode(false);
      setSuccessMessage(res.data?.message || `${selectedUserIds.length} membres ajoutés avec succès.`);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || "Erreur lors de l'ajout groupé.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleSelectUser = (id: number) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredAvailableUsers.map(u => u.id);
    const allSelected = filteredIds.every(id => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedUserIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleRemoveMember = async (userId: number, name: string) => {
    if (!confirm(`Voulez-vous vraiment retirer "${name}" du groupe ?`)) return;
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await apiClient.delete(`/groups/${groupId}/members/${userId}`);
      setSuccessMessage("Membre retiré du groupe.");
      await loadData();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || "Erreur lors de la suppression.");
    }
  };

  // Filtered members
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase().trim();
    return members.filter(m => 
      m.user_email.toLowerCase().includes(q) ||
      (m.user_nom && m.user_nom.toLowerCase().includes(q)) ||
      (m.user_prenom && m.user_prenom.toLowerCase().includes(q)) ||
      (m.user_username && m.user_username.toLowerCase().includes(q)) ||
      m.user_role.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  // Filtered available users
  const filteredAvailableUsers = useMemo(() => {
    if (!availSearch.trim()) return availableUsers;
    const q = availSearch.toLowerCase().trim();
    return availableUsers.filter(u => 
      u.email.toLowerCase().includes(q) ||
      (u.nom && u.nom.toLowerCase().includes(q)) ||
      (u.prenom && u.prenom.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  }, [availableUsers, availSearch]);

  const getDisplayName = (user: { nom?: string | null; prenom?: string | null; username?: string | null; email?: string | null; user_nom?: string | null; user_prenom?: string | null; user_username?: string | null; user_email?: string | null }) => {
    const nom = user.nom ?? user.user_nom;
    const prenom = user.prenom ?? user.user_prenom;
    const username = user.username ?? user.user_username;
    const email = user.email ?? user.user_email;

    if (prenom || nom) {
      return `${prenom || ''} ${nom || ''}`.trim();
    }
    if (username) return username;
    return email || 'Utilisateur';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 lg:p-8 overflow-y-auto">
      <div className="bg-white max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-2xl space-y-5 animate-fade-in-up max-h-[92vh] flex flex-col text-slate-900 overflow-hidden">
        
        {/* Header Panoramique */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 text-[#1877f2] flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 truncate max-w-[280px] sm:max-w-md" title={groupName}>
                {groupName}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Affectation des apprenants & gestion des effectifs en mode panoramique</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-[#1877f2] border border-blue-200/80 text-[11px] font-extrabold uppercase tracking-wide">
              {members.length} Membre{members.length > 1 ? 's' : ''} Actif{members.length > 1 ? 's' : ''}
            </span>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
            <UserCheck size={16} className="shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Corps Panoramique 2 Colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-0 overflow-y-auto pr-1">
          
          {/* Colonne Gauche : Ajouter des apprenants */}
          <div className="lg:col-span-6 bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200/90 space-y-3.5 flex flex-col justify-between shadow-2xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus size={15} className="text-[#1877f2]" />
                  <span>Ajouter des apprenants au groupe</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBatchMode(!batchMode);
                    setSelectedUserIds([]);
                  }}
                  className="text-xs font-bold text-[#1877f2] hover:underline cursor-pointer"
                >
                  {batchMode ? "Mode sélection unique" : "Mode par lot (multi-sélection)"}
                </button>
              </div>

              {batchMode ? (
                /* Batch Multi-Select Mode */
                <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={availSearch}
                        onChange={(e) => setAvailSearch(e.target.value)}
                        placeholder="Filtrer les apprenants disponibles..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1877f2]"
                      />
                    </div>
                    {filteredAvailableUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      >
                        {filteredAvailableUsers.every(u => selectedUserIds.includes(u.id)) ? "Désélectionner" : "Tout sélectionner"}
                      </button>
                    )}
                  </div>

                  <div className="h-[250px] overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-lg p-1.5">
                    {filteredAvailableUsers.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6 italic">Aucun apprenant disponible correspondant.</p>
                    ) : (
                      filteredAvailableUsers.map(u => {
                        const isChecked = selectedUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => handleToggleSelectUser(u.id)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                              isChecked ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isChecked ? (
                                <CheckSquare size={16} className="text-[#1877f2] shrink-0" />
                              ) : (
                                <Square size={16} className="text-slate-400 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">{getDisplayName(u)}</p>
                                <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                              {u.role}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-600">
                      {selectedUserIds.length} apprenant{selectedUserIds.length > 1 ? 's' : ''} sélectionné{selectedUserIds.length > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      disabled={isAdding || selectedUserIds.length === 0}
                      onClick={handleAddBatch}
                      className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      <span>Ajouter la sélection ({selectedUserIds.length})</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Single Select Mode */
                <form onSubmit={handleAddSingle} className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Sélectionnez un apprenant
                  </label>
                  <select 
                    value={singleUserId}
                    onChange={(e) => setSingleUserId(Number(e.target.value))}
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none transition-all"
                    required
                  >
                    <option value="" disabled>-- Choisir parmi les apprenants disponibles ({availableUsers.length}) --</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {getDisplayName(u)} — {u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                  <button 
                    type="submit" 
                    disabled={isAdding || availableUsers.length === 0}
                    className="w-full btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isAdding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    <span>Ajouter immédiatement au groupe</span>
                  </button>
                </form>
              )}

              {availableUsers.length === 0 && !isLoading && (
                <p className="text-xs text-slate-500 italic">Tous les apprenants enregistrés sont déjà membres de ce groupe.</p>
              )}
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/50 text-[11px] text-slate-600">
              💡 Les modifications de membres prennent effet immédiatement et synchronisent l'ensemble des plannings et cours associés.
            </div>
          </div>

          {/* Colonne Droite : Membres Actuels */}
          <div className="lg:col-span-6 space-y-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={15} className="text-[#1877f2]" />
                  <span>Membres actuels ({members.length})</span>
                </h4>
                
                {members.length > 3 && (
                  <div className="relative max-w-xs w-full">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Chercher un membre..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1877f2]"
                    />
                  </div>
                )}
              </div>
              
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[#1877f2]" size={28} />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Users size={28} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Aucun apprenant dans ce groupe pour le moment.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Utilisez le panneau de gauche pour affecter des étudiants.</p>
                </div>
              ) : (
                <div className="h-[290px] overflow-y-auto space-y-2 pr-1">
                  {filteredMembers.map(member => {
                    const displayName = getDisplayName(member);
                    const initial = (displayName.charAt(0) || 'U').toUpperCase();
                    return (
                      <div 
                        key={member.id} 
                        className="bg-slate-50 hover:bg-slate-100/80 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {member.user_avatar ? (
                            <img 
                              src={member.user_avatar} 
                              alt={displayName} 
                              className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-blue-100/80 border border-blue-200 text-[#1877f2] flex items-center justify-center text-xs font-black shrink-0">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate" title={displayName}>
                              {displayName}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
                              <span className="truncate">{member.user_email}</span>
                              <span className="inline-block font-bold text-blue-700 uppercase bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/50">
                                {member.user_role}
                              </span>
                              {member.user_departement && (
                                <span className="text-[10px] text-slate-500">
                                  • {member.user_departement}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveMember(member.user_id, displayName)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                          title="Retirer cet apprenant du groupe"
                          aria-label="Retirer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 text-right text-[11px] text-slate-400">
              {filteredMembers.length} membre(s) affiché(s)
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700 text-xs transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
