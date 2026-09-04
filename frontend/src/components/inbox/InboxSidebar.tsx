'use client';

import React from 'react';
import {
  Pencil,
  Inbox as InboxIcon,
  Layers,
  Star,
  Clock,
  Send,
  FileText,
  Trash2,
  Video,
  Calendar as CalendarIcon,
} from 'lucide-react';

export type FolderType =
  | 'inbox'
  | 'all'
  | 'starred'
  | 'snoozed'
  | 'sent'
  | 'drafts'
  | 'classroom'
  | 'trash';

export interface InboxSidebarProps {
  activeFolder: FolderType;
  onSelectFolder: (folder: FolderType) => void;
  onOpenCompose: () => void;
  onNavigateCalendar?: () => void;
  onNavigateClassroom?: () => void;
  unreadCount: number;
  draftsCount: number;
  starredCount: number;
  allCount?: number;
  isCollapsed?: boolean;
  canUseBroadcast?: boolean;
  labels?: {
    compose: string;
    inbox: string;
    allMail: string;
    starred: string;
    snoozed: string;
    sent: string;
    drafts: string;
    classroom: string;
    trash: string;
    calendar: string;
  };
}

export const InboxSidebar: React.FC<InboxSidebarProps> = ({
  activeFolder,
  onSelectFolder,
  onOpenCompose,
  onNavigateCalendar,
  onNavigateClassroom,
  unreadCount,
  draftsCount,
  starredCount,
  allCount = 0,
  isCollapsed = false,
  canUseBroadcast = true,
  labels = {
    compose: 'Rédiger',
    inbox: 'Boîte de réception',
    allMail: 'Tous les messages',
    starred: 'Favoris',
    snoozed: 'En attente',
    sent: 'Envoyés',
    drafts: 'Brouillons',
    classroom: 'Classe Virtuelle',
    trash: 'Corbeille',
    calendar: 'Calendrier',
  },
}) => {
  return (
    <aside
      className={`h-[calc(100vh-4rem)] flex flex-col border-r border-border/80 bg-background/50 backdrop-blur-md transition-all duration-300 py-4 ${
        isCollapsed ? 'w-16 px-2' : 'w-64 px-3'
      }`}
    >
      {/* 1. Large Gmail-Style Compose Pill Button */}
      <button
        type="button"
        onClick={onOpenCompose}
        className={`w-full bg-primary hover:bg-primary-hover text-white rounded-2xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-3 font-bold group mb-5 ${
          isCollapsed ? 'h-12 w-12 p-0 rounded-2xl' : 'py-3.5 px-6 text-sm'
        }`}
        title={labels.compose}
      >
        <Pencil size={18} className="group-hover:rotate-12 transition-transform shrink-0" />
        {!isCollapsed && <span>{labels.compose}</span>}
      </button>

      {/* 2. Primary Navigation Folders */}
      <nav className="space-y-1 overflow-y-auto flex-1 pr-1">
        {/* Inbox / Boîte de réception */}
        <button
          type="button"
          onClick={() => onSelectFolder('inbox')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeFolder === 'inbox'
              ? 'bg-primary/15 text-primary border border-primary/30 font-bold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
          title={labels.inbox}
        >
          <div className="flex items-center gap-3 min-w-0">
            <InboxIcon size={18} className={activeFolder === 'inbox' ? 'text-primary' : 'text-text-secondary'} />
            {!isCollapsed && <span className="truncate">{labels.inbox}</span>}
          </div>
          {!isCollapsed && unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-extrabold shadow-sm">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Tous les messages / All Mail */}
        <button
          type="button"
          onClick={() => onSelectFolder('all')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeFolder === 'all'
              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
          title={labels.allMail}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Layers size={18} className={activeFolder === 'all' ? 'text-indigo-400' : 'text-text-secondary'} />
            {!isCollapsed && <span className="truncate">{labels.allMail}</span>}
          </div>
          {!isCollapsed && allCount > 0 && (
            <span className="text-[11px] font-medium text-text-secondary">{allCount}</span>
          )}
        </button>

        {/* Starred / Favoris */}
        <button
          type="button"
          onClick={() => onSelectFolder('starred')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeFolder === 'starred'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
          title={labels.starred}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Star size={18} className={activeFolder === 'starred' ? 'text-amber-400 fill-amber-400' : 'text-text-secondary'} />
            {!isCollapsed && <span className="truncate">{labels.starred}</span>}
          </div>
          {!isCollapsed && starredCount > 0 && (
            <span className="text-[11px] font-bold text-amber-400">{starredCount}</span>
          )}
        </button>

        {/* Snoozed / En attente */}
        <button
          type="button"
          onClick={() => onSelectFolder('snoozed')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeFolder === 'snoozed'
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
          title={labels.snoozed}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Clock size={18} className={activeFolder === 'snoozed' ? 'text-cyan-400' : 'text-text-secondary'} />
            {!isCollapsed && <span className="truncate">{labels.snoozed}</span>}
          </div>
        </button>

        {/* Sent / Envoyés */}
        <button
          type="button"
          onClick={() => onSelectFolder('sent')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeFolder === 'sent'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
          title={labels.sent}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Send size={18} className={activeFolder === 'sent' ? 'text-emerald-400' : 'text-text-secondary'} />
            {!isCollapsed && <span className="truncate">{labels.sent}</span>}
          </div>
        </button>

        {/* Drafts / Brouillons */}
        <button
          type="button"
          onClick={() => onSelectFolder('drafts')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeFolder === 'drafts'
              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
          title={labels.drafts}
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className={activeFolder === 'drafts' ? 'text-purple-300' : 'text-text-secondary'} />
            {!isCollapsed && <span className="truncate">{labels.drafts}</span>}
          </div>
          {!isCollapsed && draftsCount > 0 && (
            <span className="text-[11px] font-bold text-purple-300">{draftsCount}</span>
          )}
        </button>

        {/* Classe Virtuelle (Liée au Classroom) */}
        <button
          type="button"
          onClick={() => onSelectFolder('classroom')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeFolder === 'classroom'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 font-bold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
          title={labels.classroom}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Video size={18} className={activeFolder === 'classroom' ? 'text-blue-400' : 'text-text-secondary'} />
            {!isCollapsed && <span className="truncate">{labels.classroom}</span>}
          </div>
          {!isCollapsed && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold uppercase tracking-wider">
              HD
            </span>
          )}
        </button>

        {/* Corbeille / Trash */}
        <button
          type="button"
          onClick={() => onSelectFolder('trash')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeFolder === 'trash'
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
          title={labels.trash}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Trash2 size={18} className={activeFolder === 'trash' ? 'text-rose-400' : 'text-text-secondary'} />
            {!isCollapsed && <span className="truncate">{labels.trash}</span>}
          </div>
        </button>

        {/* Calendrier / Calendar Link */}
        <div className="pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onNavigateCalendar}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface transition-all"
            title={labels.calendar}
          >
            <div className="flex items-center gap-3 min-w-0">
              <CalendarIcon size={18} className="text-emerald-400" />
              {!isCollapsed && <span className="truncate">{labels.calendar}</span>}
            </div>
          </button>
        </div>
      </nav>
    </aside>
  );
};
