'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Users,
  UserPlus,
  Send,
  Check,
  CheckCheck,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  Trash2,
  Mail,
  Bell,
  Shield,
  GraduationCap,
  Briefcase,
  Layers,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface UserItem {
  id: number;
  email: string;
  prenom?: string;
  nom?: string;
  username?: string;
  role: string;
}

interface GroupItem {
  id: number;
  name: string;
  description?: string;
  members_count?: number;
}

export interface RoomInvitation {
  id: number;
  classroom_id: number;
  inviter_id: number;
  invitee_id: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  invitee?: UserItem;
  inviter?: UserItem;
}

interface ClassroomInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomTitle: string;
  isHost?: boolean;
  onInvitedSuccess?: (count: number) => void;
}

export default function ClassroomInviteModal({
  isOpen,
  onClose,
  roomId,
  roomTitle,
  isHost = true,
  onInvitedSuccess,
}: ClassroomInviteModalProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'tracking'>('users');

  // Available data
  const [availableUsers, setAvailableUsers] = useState<UserItem[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupItem[]>([]);
  const [roomInvitations, setRoomInvitations] = useState<RoomInvitation[]>([]);

  // Selection states
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  // Options
  const [sendEmail, setSendEmail] = useState(true);
  const [sendNotification, setSendNotification] = useState(true);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Loading & Feedback
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedUserIds([]);
      setSelectedGroupIds([]);
      setActionMessage(null);
      setSearchQuery('');
      return;
    }

    const loadData = async () => {
      setIsLoadingData(true);
      setActionMessage(null);
      try {
        const [usersRes, groupsRes, invRes] = await Promise.all([
          apiClient.get('/users/').catch(() => ({ data: [] })),
          apiClient.get('/groups/').catch(() => ({ data: [] })),
          apiClient.get(`/classrooms/${roomId}/invitations`).catch(() => ({ data: [] })),
        ]);

        if (Array.isArray(usersRes.data)) {
          setAvailableUsers(usersRes.data);
        }
        if (Array.isArray(groupsRes.data)) {
          setAvailableGroups(groupsRes.data);
        }
        if (Array.isArray(invRes.data)) {
          setRoomInvitations(invRes.data);
        }
      } catch {
        // Silently handled
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [isOpen, roomId]);

  // Live debounced search against backend for any users outside initial 100 limit
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/users/search?q=${encodeURIComponent(q)}`);
        if (Array.isArray(res.data)) {
          setAvailableUsers((prev) => {
            const map = new Map(prev.map((u) => [u.id, u]));
            res.data.forEach((u: any) => {
              if (!map.has(u.id)) {
                map.set(u.id, {
                  id: u.id,
                  email: u.email,
                  prenom: u.prenom,
                  nom: u.nom,
                  username: u.username,
                  role: u.role,
                });
              }
            });
            return Array.from(map.values());
          });
        }
      } catch {
        // Silently ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return availableUsers.filter((u) => {
      const fullName = `${u.prenom || ''} ${u.nom || ''} ${u.username || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || fullName.includes(q) || email.includes(q);
      const matchesRole = roleFilter === 'all' || u.role.toLowerCase() === roleFilter.toLowerCase();
      return matchesSearch && matchesRole;
    });
  }, [availableUsers, searchQuery, roleFilter]);

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const selectAllFilteredUsers = () => {
    const allFilteredIds = filteredUsers.map((u) => u.id);
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const deselectAllFilteredUsers = () => {
    const filteredSet = new Set(filteredUsers.map((u) => u.id));
    setSelectedUserIds((prev) => prev.filter((id) => !filteredSet.has(id)));
  };

  // Submit Invitations
  const handleSendInvitations = async () => {
    if (selectedUserIds.length === 0 && selectedGroupIds.length === 0) {
      setActionMessage({ type: 'error', text: 'Veuillez sélectionner au moins un utilisateur ou un groupe.' });
      return;
    }

    setIsSending(true);
    setActionMessage(null);
    try {
      const res = await apiClient.post(`/classrooms/${roomId}/invite`, {
        user_ids: selectedUserIds,
        group_ids: selectedGroupIds,
        send_email: sendEmail,
        send_notification: sendNotification,
        pre_enroll_attendance: true,
      });

      const invitedCount = res.data?.invited_count || selectedUserIds.length;
      setActionMessage({
        type: 'success',
        text: `${invitedCount} invitation(s) envoyée(s) avec succès !`,
      });

      setSelectedUserIds([]);
      setSelectedGroupIds([]);

      // Refresh invitations list
      const invRes = await apiClient.get(`/classrooms/${roomId}/invitations`).catch(() => ({ data: [] }));
      if (Array.isArray(invRes.data)) {
        setRoomInvitations(invRes.data);
      }

      onInvitedSuccess?.(invitedCount);

      setTimeout(() => {
        if (activeTab !== 'tracking') {
          setActiveTab('tracking');
        }
      }, 1200);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Erreur lors de l'envoi des invitations.";
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsSending(false);
    }
  };

  // Resend single invitation
  const handleResend = async (invId: number) => {
    setResendingId(invId);
    try {
      await apiClient.post(`/classrooms/${roomId}/invitations/${invId}/resend`);
      setActionMessage({ type: 'success', text: 'Rappel d’invitation envoyé avec succès !' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || "Échec de l'envoi du rappel." });
    } finally {
      setResendingId(null);
    }
  };

  // Cancel single invitation
  const handleCancel = async (invId: number) => {
    setCancelingId(invId);
    try {
      await apiClient.delete(`/classrooms/${roomId}/invitations/${invId}`);
      setRoomInvitations((prev) => prev.filter((i) => i.id !== invId));
      setActionMessage({ type: 'success', text: 'Invitation annulée.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || "Échec de l'annulation." });
    } finally {
      setCancelingId(null);
    }
  };

  if (!isOpen) return null;

  const totalSelectedCount = selectedUserIds.length + (selectedGroupIds.length > 0 ? ` (${selectedGroupIds.length} groupes)` : '');

  return (
    <div className="fixed inset-0 z-[10010] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#111827] border border-white/15 text-slate-100 shadow-2xl rounded-3xl max-w-2xl w-full my-auto flex flex-col max-h-[90vh] overflow-hidden relative">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#1f2937]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-blue-500 text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white leading-tight">
                Inviter des participants
              </h3>
              <p className="text-xs text-gray-400">
                Salle : <span className="font-semibold text-emerald-400">{roomTitle}</span> ({roomId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#111827] px-4 pt-2 gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users size={16} />
            <span>Utilisateurs</span>
            {selectedUserIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary text-white font-extrabold">
                {selectedUserIds.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'groups'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers size={16} />
            <span>Groupes / Classes</span>
            {selectedGroupIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500 text-white font-extrabold">
                {selectedGroupIds.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tracking')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'tracking'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Clock size={16} />
            <span>Suivi des Invitations</span>
            {roomInvitations.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-gray-300 font-extrabold">
                {roomInvitations.length}
              </span>
            )}
          </button>
        </div>

        {/* Feedback Alert */}
        {actionMessage && (
          <div
            className={`mx-4 sm:mx-6 mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}
          >
            {actionMessage.type === 'success' ? <Check size={16} /> : <XCircle size={16} />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* TAB 1: INDIVIDUAL USERS */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              {/* Search & Role Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom, prénom ou email..."
                    className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 bg-[#1f2937] border border-white/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">Tous les rôles</option>
                  <option value="etudiant">Étudiants</option>
                  <option value="stagiaire">Stagiaires</option>
                  <option value="formateur">Formateurs</option>
                  <option value="admin">Administrateurs</option>
                </select>
              </div>

              {/* Bulk actions bar */}
              <div className="flex items-center justify-between text-xs text-gray-400 py-1">
                <span>
                  {filteredUsers.length} utilisateur(s) trouvé(s) — <strong className="text-white">{selectedUserIds.length}</strong> sélectionné(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllFilteredUsers}
                    className="hover:text-primary transition-colors font-semibold"
                  >
                    Tout sélectionner
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={deselectAllFilteredUsers}
                    className="hover:text-gray-200 transition-colors"
                  >
                    Désélectionner
                  </button>
                </div>
              </div>

              {/* Users List */}
              {isLoadingData ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="text-xs">Chargement des utilisateurs...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  Aucun utilisateur ne correspond à votre recherche.
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUserIds.includes(user.id);
                    const displayName = `${user.prenom || ''} ${user.nom || ''}`.trim() || user.username || user.email.split('@')[0];
                    const isAlreadyInvited = roomInvitations.some((i) => i.invitee_id === user.id && i.status === 'pending');

                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-primary/15 border-primary/60 shadow-sm'
                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                              isSelected
                                ? 'bg-primary border-primary text-white'
                                : 'border-white/30 bg-transparent'
                            }`}
                          >
                            {isSelected && <Check size={13} strokeWidth={3} />}
                          </div>

                          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs text-gray-200 shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white truncate">{displayName}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-mono font-semibold bg-white/10 text-gray-300">
                                {user.role}
                              </span>
                              {isAlreadyInvited && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Déjà invité
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GROUPS / CLASSES */}
          {activeTab === 'groups' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Sélectionnez une ou plusieurs classes pour inviter tous les membres d&apos;un seul clic.
              </p>

              {availableGroups.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  Aucun groupe disponible pour cette promotion.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availableGroups.map((group) => {
                    const isSelected = selectedGroupIds.includes(group.id);

                    return (
                      <div
                        key={group.id}
                        onClick={() => toggleGroupSelection(group.id)}
                        className={`p-4 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-500/15 border-blue-500/60 shadow-sm'
                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-white/30 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check size={13} strokeWidth={3} />}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-white truncate">{group.name}</h4>
                          {group.description && (
                            <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{group.description}</p>
                          )}
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-gray-300 font-semibold">
                            <Users size={11} />
                            <span>Groupe d&apos;apprenants</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INVITATION TRACKING */}
          {activeTab === 'tracking' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Historique des invitations pour cette session</span>
                <span className="font-semibold text-white">{roomInvitations.length} invitation(s)</span>
              </div>

              {roomInvitations.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  Aucune invitation envoyée pour le moment.
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                  {roomInvitations.map((inv) => {
                    const inviteeName = inv.invitee
                      ? `${inv.invitee.prenom || ''} ${inv.invitee.nom || ''}`.trim() || inv.invitee.username || inv.invitee.email
                      : `Utilisateur #${inv.invitee_id}`;
                    const inviteeEmail = inv.invitee?.email || '';

                    return (
                      <div
                        key={inv.id}
                        className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs text-gray-200 shrink-0">
                            {inviteeName.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white truncate">{inviteeName}</span>
                              {inv.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <Clock size={10} /> En attente
                                </span>
                              )}
                              {inv.status === 'accepted' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 size={10} /> Acceptée
                                </span>
                              )}
                              {inv.status === 'declined' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  <XCircle size={10} /> Refusée
                                </span>
                              )}
                            </div>
                            {inviteeEmail && (
                              <p className="text-[11px] text-gray-400 truncate">{inviteeEmail}</p>
                            )}
                          </div>
                        </div>

                        {/* Actions for Host */}
                        {isHost && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {inv.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  disabled={resendingId === inv.id}
                                  onClick={() => handleResend(inv.id)}
                                  className="p-2 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                  title="Renvoyer un rappel de notification et email"
                                >
                                  {resendingId === inv.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <RotateCw size={14} />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  disabled={cancelingId === inv.id}
                                  onClick={() => handleCancel(inv.id)}
                                  className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                  title="Annuler l'invitation"
                                >
                                  {cancelingId === inv.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer / Dispatch Actions */}
        {activeTab !== 'tracking' && (
          <div className="p-4 sm:p-5 border-t border-white/10 bg-[#1f2937]/90 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Dispatch Options */}
            <div className="flex items-center gap-4 text-xs text-gray-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="rounded bg-white/10 border-white/20 text-primary focus:ring-0"
                />
                <span className="flex items-center gap-1">
                  <Bell size={13} className="text-amber-400" /> Notification en direct
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded bg-white/10 border-white/20 text-primary focus:ring-0"
                />
                <span className="flex items-center gap-1">
                  <Mail size={13} className="text-cyan-400" /> Email
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={isSending || (selectedUserIds.length === 0 && selectedGroupIds.length === 0)}
              onClick={handleSendInvitations}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-primary/20 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>
                    Envoyer les invitations {selectedUserIds.length > 0 || selectedGroupIds.length > 0 ? `(${selectedUserIds.length + selectedGroupIds.length})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
