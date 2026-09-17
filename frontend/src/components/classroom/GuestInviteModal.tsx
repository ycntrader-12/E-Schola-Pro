'use client';

import React from 'react';
import { Video, Check, X, Users, Sparkles, Radio, Loader2 } from 'lucide-react';

export interface ClassroomInviteNotification {
  invitation_id: number;
  room_id: string;
  room_title: string;
  inviter_name: string;
  inviter_email?: string;
  created_at?: string;
}

interface GuestInviteModalProps {
  invite: ClassroomInviteNotification | null;
  isOpen: boolean;
  onAccept: (invitationId: number, roomId: string) => Promise<void>;
  onDecline: (invitationId: number) => Promise<void>;
  isProcessing?: boolean;
}

export default function GuestInviteModal({
  invite,
  isOpen,
  onAccept,
  onDecline,
  isProcessing = false,
}: GuestInviteModalProps) {
  if (!isOpen || !invite) return null;

  return (
    <div className="fixed inset-0 z-[10020] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border-2 border-emerald-400/60 shadow-2xl shadow-emerald-500/20 max-w-md w-full p-6 sm:p-7 rounded-3xl text-slate-900 text-center animate-zoom-in my-auto relative overflow-hidden">
        
        {/* Top Glow Ambient Effect */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500" />
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Live Call Pulsing Icon */}
        <div className="relative inline-flex items-center justify-center mb-5">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 border-2 border-emerald-200 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Video size={36} className="animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
          </span>
        </div>

        {/* Badge & Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
            <Radio size={12} className="animate-pulse text-emerald-600" /> Invitation en Direct
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
            {invite.room_title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            <span className="font-bold text-slate-900">{invite.inviter_name}</span> vous convie à participer à une visioconférence interactive.
          </p>
        </div>

        {/* Session Metadata Card */}
        <div className="my-5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-around text-xs text-slate-600">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Code de Salle</span>
            <span className="font-mono font-bold text-slate-900">{invite.room_id}</span>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Qualité</span>
            <span className="font-bold text-emerald-600">HD WebRTC SFU</span>
          </div>
        </div>

        {/* Action Buttons: Accept or Decline */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onAccept(invite.invitation_id, invite.room_id)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Connexion en cours...</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>Accepter et Rejoindre</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onDecline(invite.invitation_id)}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <X size={15} />
            <span>Refuser l'invitation</span>
          </button>
        </div>

      </div>
    </div>
  );
}
