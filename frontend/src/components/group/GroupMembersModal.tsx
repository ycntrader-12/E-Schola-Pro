'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Plus, Loader2, Users, User, ShieldAlert } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface GroupMembersModalProps {
  groupId: number;
  groupName: string;
  onClose: () => void;
}

export default function GroupMembersModal({ groupId, groupName, onClose }: GroupMembersModalProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');

  const fetchMembers = async () => {
    try {
      const res = await apiClient.get(`/groups/${groupId}/members`);
      setMembers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const res = await apiClient.get(`/groups/available-users?group_id=${groupId}`);
      setAvailableUsers(res.data);
    } catch (err) {
      console.error(err);
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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    
    setIsAdding(true);
    try {
      await apiClient.post(`/groups/${groupId}/members`, { user_id: Number(selectedUserId) });
      setSelectedUserId('');
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de l'ajout.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm("Voulez-vous vraiment retirer cet utilisateur du groupe ?")) return;
    
    try {
      await apiClient.delete(`/groups/${groupId}/members/${userId}`);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la suppression.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xl space-y-5 animate-fade-in-up max-h-[90vh] flex flex-col text-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-[#1877f2] flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 truncate max-w-[280px] sm:max-w-xs" title={groupName}>
                {groupName}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Gestion et affectation des membres</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6">
          
          {/* Add Member Form */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ajouter un apprenant au groupe
            </label>
            <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-2">
              <select 
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="flex-1 bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-medium focus:outline-none transition-all"
                required
              >
                <option value="" disabled>-- Sélectionner un apprenant disponible --</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email} ({u.role})
                  </option>
                ))}
              </select>
              <button 
                type="submit" 
                disabled={isAdding || availableUsers.length === 0}
                className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isAdding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                <span>Ajouter</span>
              </button>
            </form>
            {availableUsers.length === 0 && !isLoading && (
              <p className="text-[11px] text-slate-500 italic">Tous les apprenants enregistrés sont déjà membres de ce groupe.</p>
            )}
          </div>

          {/* Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Membres actuels ({members.length})
              </h4>
              <span className="text-xs font-semibold text-slate-500">
                {members.length} apprenant{members.length > 1 ? 's' : ''}
              </span>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-[#1877f2]" size={28} />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm font-semibold text-slate-600">Aucun apprenant dans ce groupe pour le moment.</p>
                <p className="text-xs text-slate-400 mt-1">Utilisez le sélecteur ci-dessus pour affecter des étudiants.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {members.map(member => (
                  <div 
                    key={member.id} 
                    className="bg-slate-50 hover:bg-slate-100/70 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100/70 border border-blue-200/70 text-[#1877f2] flex items-center justify-center text-xs font-black shrink-0">
                        {String(member.user_email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate" title={member.user_email}>
                          {member.user_email}
                        </p>
                        <span className="inline-block text-[10px] font-bold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200/50 mt-0.5">
                          {member.user_role}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                      title="Retirer cet apprenant du groupe"
                      aria-label="Retirer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
