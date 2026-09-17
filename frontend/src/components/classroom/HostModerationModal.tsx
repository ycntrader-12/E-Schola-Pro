'use client';

import React, { useState } from 'react';
import {
  Shield,
  Users,
  Check,
  X,
  Ban,
  MicOff,
  UserX,
  VolumeX,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { WaitingUser, SFUPeer } from '@/lib/sfuClient';

interface HostModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  waitingUsers: WaitingUser[];
  activePeers: SFUPeer[];
  onAdmit: (userId: number) => void;
  onAdmitAll: () => void;
  onReject: (userId: number) => void;
  onBlock: (userId: number) => void;
  onKick: (userId: number) => void;
  onMuteUser: (userId: number) => void;
  onMuteAll: () => void;
}

export default function HostModerationModal({
  isOpen,
  onClose,
  waitingUsers,
  activePeers,
  onAdmit,
  onAdmitAll,
  onReject,
  onBlock,
  onKick,
  onMuteUser,
  onMuteAll,
}: HostModerationModalProps) {
  const [activeTab, setActiveTab] = useState<'waiting' | 'active'>('waiting');
  const [confirmBlockUser, setConfirmBlockUser] = useState<WaitingUser | SFUPeer | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 shadow-2xl max-w-2xl w-full my-auto flex flex-col max-h-[90vh] relative animate-fade-in-up rounded-2xl overflow-hidden text-slate-900">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-200">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Gestion des Accès & Modération
              </h3>
              <p className="text-xs text-slate-500">
                Contrôlez les demandes d'entrée, la salle d'attente et les participants connectés.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 pt-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('waiting')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'waiting'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock size={16} />
            <span>Salle d'attente</span>
            {waitingUsers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 font-extrabold animate-pulse">
                {waitingUsers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users size={16} />
            <span>Participants actifs ({activePeers.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {activeTab === 'waiting' ? (
            <div className="space-y-4">
              {/* Batch Action Bar */}
              {waitingUsers.length > 0 ? (
                <div className="flex items-center justify-between bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                  <div className="text-xs text-blue-900 font-medium">
                    <span className="font-bold">{waitingUsers.length}</span> participant(s) en attente d'approbation
                  </div>
                  <button
                    type="button"
                    onClick={onAdmitAll}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 size={15} /> Tout accepter
                  </button>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <UserCheck size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Aucun participant en attente</p>
                  <p className="text-xs text-slate-500">
                    Les nouvelles demandes d'accès s'afficheront ici en direct avec signal sonore.
                  </p>
                </div>
              )}

              {/* Waiting Users List */}
              <div className="space-y-2.5">
                {waitingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-blue-300"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center shrink-0 text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{user.name}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {user.role}
                          </span>
                          {user.group_name && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {user.group_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Demande à {user.requested_at}</p>
                      </div>
                    </div>

                    {/* Action Buttons: Accept / Reject / Block */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => onAdmit(user.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        title="Accepter dans la réunion"
                      >
                        <Check size={14} /> Accepter
                      </button>

                      <button
                        type="button"
                        onClick={() => onReject(user.id)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        title="Refuser l'accès"
                      >
                        <X size={14} /> Refuser
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmBlockUser(user)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        title="Bloquer / Bannir définitivement de cette session"
                      >
                        <Ban size={14} /> Bloquer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Global Mute All Action */}
              <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-700 font-medium">
                  Modération collective des apprenants connectés
                </div>
                <button
                  type="button"
                  onClick={onMuteAll}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <VolumeX size={15} /> Couper tous les micros
                </button>
              </div>

              {/* Active Peers List */}
              <div className="space-y-2.5">
                {activePeers.map((peer) => (
                  <div
                    key={peer.id}
                    className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                        {peer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{peer.name}</h4>
                          {peer.is_host && (
                            <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              Hôte
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{peer.email}</p>
                      </div>
                    </div>

                    {!peer.is_host && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onMuteUser(peer.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Couper le micro à distance"
                        >
                          <MicOff size={13} /> Muter
                        </button>

                        <button
                          type="button"
                          onClick={() => onKick(peer.id)}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Exclure de la session (Kick)"
                        >
                          <UserX size={13} /> Exclure
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmBlockUser(peer)}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Bloquer / Bannir de la session"
                        >
                          <Ban size={13} /> Bloquer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
          >
            Fermer la modération
          </button>
        </div>

      </div>

      {/* Confirmation Dialog for Permanent Block */}
      {confirmBlockUser && (
        <div className="fixed inset-0 z-[10010] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl border border-red-200 shadow-2xl space-y-4 animate-zoom-in text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                Bloquer {confirmBlockUser.name} ?
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Cet utilisateur sera immédiatement exclu et ne pourra plus solliciter l'accès à cette session de visioconférence.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBlockUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onBlock(confirmBlockUser.id);
                  setConfirmBlockUser(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <Ban size={14} /> Confirmer le blocage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
