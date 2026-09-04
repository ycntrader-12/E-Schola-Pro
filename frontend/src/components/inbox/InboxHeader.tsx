'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  SlidersHorizontal,
  HelpCircle,
  Settings,
  Grid,
  Sparkles,
  X,
  Globe,
  Bot,
  User as UserIcon,
  Video,
  Calendar,
  ClipboardList,
  GraduationCap,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Link } from '@/i18n/routing';

export type SearchMode = 'internal' | 'google' | 'ai';

export interface InboxHeaderProps {
  onToggleSidebar: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
  onOpenAiModal: () => void;
  currentUser: {
    id: number;
    email: string;
    role: string;
    avatar_url?: string;
  } | null;
  labels?: {
    internal: string;
    google: string;
    ai: string;
    placeholderInternal: string;
    placeholderGoogle: string;
    placeholderAi: string;
  };
}

export const InboxHeader: React.FC<InboxHeaderProps> = ({
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  searchMode,
  onSearchModeChange,
  onOpenAiModal,
  currentUser,
  labels = {
    internal: 'Interne',
    google: 'Google Web',
    ai: 'Google IA (Gemini)',
    placeholderInternal: 'Rechercher dans les messages ScholaPro...',
    placeholderGoogle: 'Rechercher sur Google Web...',
    placeholderAi: 'Demander à l\'assistant IA Google Gemini...',
  },
}) => {
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isAppsGridOpen, setIsAppsGridOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const appsGridRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setIsModeDropdownOpen(false);
      }
      if (appsGridRef.current && !appsGridRef.current.contains(e.target as Node)) {
        setIsAppsGridOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchMode === 'google' && searchQuery.trim()) {
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`,
          '_blank',
          'noopener,noreferrer'
        );
      } else if (searchMode === 'ai' && searchQuery.trim()) {
        onOpenAiModal();
      }
    }
  };

  const currentPlaceholder =
    searchMode === 'internal'
      ? labels.placeholderInternal
      : searchMode === 'google'
      ? labels.placeholderGoogle
      : labels.placeholderAi;

  return (
    <header className="h-16 px-4 flex items-center justify-between border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      {/* Left: Sidebar Toggle + ScholaPro Logo (Replacing Gmail) */}
      <div className="flex items-center gap-3 min-w-[240px]">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2.5 rounded-full hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
          title="Menu de navigation"
        >
          <Menu size={20} />
        </button>

        {/* ScholaPro Logo & Brand (Replaces Gmail logo) */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-hover flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
            E
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-text-primary group-hover:text-primary transition-colors flex items-center gap-1">
              ScholaPro <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">Inbox</span>
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Multi-Mode Search Bar (Internal / Google Web / Google AI) */}
      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative flex items-center w-full">
          <div
            className={`w-full h-11 px-3.5 rounded-2xl border transition-all flex items-center gap-2.5 shadow-sm ${
              searchMode === 'ai'
                ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/20'
                : searchMode === 'google'
                ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/20'
                : 'bg-surface border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30'
            }`}
          >
            {/* Search Icon */}
            {searchMode === 'ai' ? (
              <Sparkles size={18} className="text-purple-400 shrink-0 animate-pulse" />
            ) : searchMode === 'google' ? (
              <Globe size={18} className="text-cyan-400 shrink-0" />
            ) : (
              <Search size={18} className="text-text-secondary shrink-0" />
            )}

            {/* Input field */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={currentPlaceholder}
              className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-secondary/60 outline-none border-none"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-surface-hover transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            )}

            {/* Search Mode Selector Dropdown */}
            <div ref={modeDropdownRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition-colors ${
                  searchMode === 'ai'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : searchMode === 'google'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-surface/80 text-text-secondary border-border hover:text-text-primary'
                }`}
              >
                {searchMode === 'ai' && <Sparkles size={12} />}
                {searchMode === 'google' && <Globe size={12} />}
                {searchMode === 'internal' && <Search size={12} />}
                <span>
                  {searchMode === 'ai'
                    ? labels.ai
                    : searchMode === 'google'
                    ? labels.google
                    : labels.internal}
                </span>
                <ChevronDown size={12} />
              </button>

              {isModeDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-surface border border-border rounded-2xl shadow-2xl z-50 py-1.5 divide-y divide-border/40 animate-scale-in">
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSearchModeChange('internal');
                        setIsModeDropdownOpen(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-colors ${
                        searchMode === 'internal'
                          ? 'bg-primary/20 text-primary'
                          : 'hover:bg-primary/10 text-text-primary'
                      }`}
                    >
                      <Search size={14} className="text-primary" />
                      <div>
                        <div>{labels.internal}</div>
                        <div className="text-[10px] text-text-secondary font-normal">
                          Messages, fichiers, contacts ScholaPro
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSearchModeChange('google');
                        setIsModeDropdownOpen(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-colors ${
                        searchMode === 'google'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'hover:bg-cyan-500/10 text-text-primary'
                      }`}
                    >
                      <Globe size={14} className="text-cyan-400" />
                      <div>
                        <div>{labels.google}</div>
                        <div className="text-[10px] text-text-secondary font-normal">
                          Recherche externe sur le web
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSearchModeChange('ai');
                        setIsModeDropdownOpen(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-colors ${
                        searchMode === 'ai'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'hover:bg-purple-500/10 text-text-primary'
                      }`}
                    >
                      <Sparkles size={14} className="text-purple-400" />
                      <div>
                        <div>{labels.ai}</div>
                        <div className="text-[10px] text-text-secondary font-normal">
                          Assistant IA pour résumer & rédiger
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Actions, AI Sparkle, Help, Settings, Apps Grid, Profile Avatar */}
      <div className="flex items-center gap-1.5">
        {/* Google AI Gemini Sparkle Button */}
        <button
          type="button"
          onClick={onOpenAiModal}
          className="p-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm group"
          title="Ouvrir l'Assistant IA Google Gemini"
        >
          <Sparkles size={16} className="text-purple-400 group-hover:rotate-12 transition-transform" />
          <span className="hidden lg:inline">Assistant IA</span>
        </button>

        {/* Help / FAQ Modal */}
        <button
          type="button"
          onClick={() => alert('Centre d\'aide & FAQ ScholaPro\nBesoin d\'assistance ? Contactez support@eschola.pro')}
          className="p-2.5 rounded-full hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
          title="Aide & Support"
        >
          <HelpCircle size={18} />
        </button>

        {/* Settings link */}
        <Link
          href="/settings"
          className="p-2.5 rounded-full hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
          title="Paramètres de l'application"
        >
          <Settings size={18} />
        </Link>

        {/* Apps Launcher 3x3 Grid */}
        <div ref={appsGridRef} className="relative">
          <button
            type="button"
            onClick={() => setIsAppsGridOpen(!isAppsGridOpen)}
            className="p-2.5 rounded-full hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
            title="Applications ScholaPro"
          >
            <Grid size={18} />
          </button>

          {isAppsGridOpen && (
            <div className="absolute right-0 mt-2 w-72 p-4 bg-surface border border-border rounded-2xl shadow-2xl z-50 animate-scale-in">
              <div className="text-xs font-bold uppercase text-text-secondary tracking-wider mb-3">
                Écosystème ScholaPro
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Link
                  href="/classroom"
                  onClick={() => setIsAppsGridOpen(false)}
                  className="p-3 rounded-xl hover:bg-primary/10 border border-transparent hover:border-primary/20 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <Video size={20} className="text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-semibold text-text-primary">Classe</span>
                </Link>

                <Link
                  href="/calendar"
                  onClick={() => setIsAppsGridOpen(false)}
                  className="p-3 rounded-xl hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <Calendar size={20} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-semibold text-text-primary">Agenda</span>
                </Link>

                <Link
                  href="/tasks"
                  onClick={() => setIsAppsGridOpen(false)}
                  className="p-3 rounded-xl hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <ClipboardList size={20} className="text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-semibold text-text-primary">Devoirs</span>
                </Link>

                <Link
                  href="/courses"
                  onClick={() => setIsAppsGridOpen(false)}
                  className="p-3 rounded-xl hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <GraduationCap size={20} className="text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-semibold text-text-primary">Cours</span>
                </Link>

                <Link
                  href="/profile"
                  onClick={() => setIsAppsGridOpen(false)}
                  className="p-3 rounded-xl hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <UserIcon size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-semibold text-text-primary">Profil</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar & Menu */}
        <div ref={profileMenuRef} className="relative ml-1">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/40 flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-primary/40 transition-all shrink-0 overflow-hidden"
          >
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.email}
                className="w-full h-full object-cover"
              />
            ) : (
              (currentUser?.email || 'U').charAt(0).toUpperCase()
            )}
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 p-3 bg-surface border border-border rounded-2xl shadow-2xl z-50 space-y-2 animate-scale-in">
              <div className="pb-2 border-b border-border">
                <p className="text-xs font-bold text-text-primary truncate">
                  {currentUser?.email}
                </p>
                <span className="text-[10px] uppercase font-bold text-primary">
                  {currentUser?.role || 'Utilisateur'}
                </span>
              </div>

              <Link
                href="/profile"
                onClick={() => setIsProfileMenuOpen(false)}
                className="flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors"
              >
                <UserIcon size={14} className="text-primary" />
                Mon Profil
              </Link>

              <Link
                href="/settings"
                onClick={() => setIsProfileMenuOpen(false)}
                className="flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors"
              >
                <Settings size={14} className="text-cyan-400" />
                Paramètres du compte
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
