'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Plus, Loader2, Users } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full p-6 rounded-3xl border border-primary/30 space-y-6 animate-fade-in-up max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-primary font-bold text-base">
            <Users size={20} />
            <h3>Membres de {groupName}</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-2">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
          
          {/* Add Member Form */}
          <form onSubmit={handleAddMember} className="flex gap-2">
            <select 
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              required
            >
              <option value="" disabled>-- Sélectionner un étudiant --</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.role})
                </option>
              ))}
            </select>
            <button 
              type="submit" 
              disabled={isAdding || availableUsers.length === 0}
              className="btn-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shrink-0"
            >
              {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Ajouter
            </button>
          </form>

          {/* Members List */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-text-secondary uppercase">
              Membres actuels ({members.length})
            </h4>
            
            {isLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>
            ) : members.length === 0 ? (
              <p className="text-xs text-text-secondary italic">Aucun membre dans ce groupe.</p>
            ) : (
              <div className="grid gap-2">
                {members.map(member => (
                  <div key={member.id} className="bg-background p-3 rounded-xl border border-border flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{member.user_email}</p>
                      <p className="text-[10px] text-text-secondary uppercase mt-0.5">{member.user_role}</p>
                    </div>
                    <button 
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="text-text-secondary hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors shrink-0"
                      title="Retirer du groupe"
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
