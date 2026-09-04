'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  ClipboardList,
  Users,
  ChevronRight,
  ChevronLeft,
  X,
  Send,
  Loader2,
  CheckCircle2,
  Video,
} from 'lucide-react';
import { Link } from '@/i18n/routing';

export type DockTab = 'ai' | 'calendar' | 'tasks' | 'contacts' | null;

export interface InboxRightDockProps {
  onOpenAiModal: () => void;
}

export const InboxRightDock: React.FC<InboxRightDockProps> = ({ onOpenAiModal }) => {
  const [activeTab, setActiveTab] = useState<DockTab>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const toggleTab = (tab: DockTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsAiLoading(true);
    setAiResponse(null);

    // Simulate AI Gemini response
    setTimeout(() => {
      setAiResponse(
        `✨ **Réponse Google Gemini IA** :\nVoici une synthèse de votre requête pour ScholaPro :\n- "${aiPrompt.trim()}"\n\nVous pouvez copier ce texte directement dans votre composeur de message.`
      );
      setIsAiLoading(false);
    }, 800);
  };

  return (
    <div className="flex relative z-30">
      {/* Expanded Dock Panel Side Drawer */}
      {activeTab && (
        <div className="w-80 h-[calc(100vh-4rem)] border-l border-border/80 bg-background/95 backdrop-blur-xl p-4 flex flex-col justify-between shadow-2xl animate-fade-in-left">
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-text-primary">
              {activeTab === 'ai' && (
                <>
                  <Sparkles size={16} className="text-purple-400" />
                  <span>Assistant IA Google Gemini</span>
                </>
              )}
              {activeTab === 'calendar' && (
                <>
                  <Calendar size={16} className="text-cyan-400" />
                  <span>Agenda ScholaPro</span>
                </>
              )}
              {activeTab === 'tasks' && (
                <>
                  <ClipboardList size={16} className="text-amber-400" />
                  <span>Mes Devoirs & Tâches</span>
                </>
              )}
              {activeTab === 'contacts' && (
                <>
                  <Users size={16} className="text-emerald-400" />
                  <span>Annuaire Contacts</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4 text-xs">
            {/* AI Gemini Chat Panel */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-1">
                  <p className="font-bold text-purple-300">✨ Assistant IA Gemini</p>
                  <p className="text-text-secondary text-[11px]">
                    Posez une question, demandez la rédaction d'un message ou résumez du contenu en direct.
                  </p>
                </div>

                <form onSubmit={handleAiSubmit} className="space-y-2">
                  <textarea
                    rows={4}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ex: Rédige un mail professionnel pour demander un délai de de devoirs..."
                    className="w-full p-3 rounded-xl bg-surface border border-border focus:border-purple-500 text-xs outline-none resize-none leading-relaxed text-text-primary"
                  />
                  <button
                    type="submit"
                    disabled={isAiLoading}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-purple-600/25"
                  >
                    {isAiLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Send size={14} /> Générer avec Gemini
                      </>
                    )}
                  </button>
                </form>

                {aiResponse && (
                  <div className="p-3.5 bg-surface rounded-xl border border-purple-500/30 text-text-primary space-y-2 whitespace-pre-wrap animate-fade-in-up">
                    <p>{aiResponse}</p>
                  </div>
                )}
              </div>
            )}

            {/* Calendar Quick View */}
            {activeTab === 'calendar' && (
              <div className="space-y-3">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-cyan-300">Événements à venir</span>
                  <Link href="/calendar" className="text-[10px] text-cyan-400 hover:underline">
                    Ouvrir l'agenda
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] font-bold uppercase text-primary">Aujourd'hui • 14:00</span>
                    <p className="font-bold text-text-primary">Classe Virtuelle : IA & Deep Learning</p>
                    <p className="text-[11px] text-text-secondary">Présence obligatoire</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] font-bold uppercase text-amber-400">Demain • 10:00</span>
                    <p className="font-bold text-text-primary">Évaluation Quiz Python</p>
                    <p className="text-[11px] text-text-secondary">Durée : 30 minutes</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tasks / Deliverables Quick View */}
            {activeTab === 'tasks' && (
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-amber-300">Mes Devoirs à rendre</span>
                  <Link href="/tasks" className="text-[10px] text-amber-400 hover:underline">
                    Voir les devoirs
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-surface border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text-primary">Projet Next.js Fullstack</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">Urgent</span>
                    </div>
                    <p className="text-[11px] text-text-secondary">Échéance : Demain 23:59</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contacts Directory Quick View */}
            {activeTab === 'contacts' && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <span className="font-bold text-emerald-300">Annuaire des utilisateurs</span>
                  <p className="text-[11px] text-text-secondary">Formateurs, administrateurs & apprenants</p>
                </div>
                <p className="text-center text-text-secondary text-[11px] py-4">
                  Utilisez la barre de recherche en haut pour trouver des destinataires.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dock Vertical Icon Bar */}
      <div className="w-14 h-[calc(100vh-4rem)] border-l border-border/80 bg-background/60 backdrop-blur-md flex flex-col items-center py-4 space-y-4">
        {/* Gemini AI Toggle */}
        <button
          type="button"
          onClick={() => toggleTab('ai')}
          className={`p-2.5 rounded-2xl transition-all ${
            activeTab === 'ai'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'hover:bg-surface text-text-secondary hover:text-purple-400'
          }`}
          title="Assistant IA Google Gemini"
        >
          <Sparkles size={20} />
        </button>

        {/* Calendar Toggle */}
        <button
          type="button"
          onClick={() => toggleTab('calendar')}
          className={`p-2.5 rounded-2xl transition-all ${
            activeTab === 'calendar'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg'
              : 'hover:bg-surface text-text-secondary hover:text-cyan-400'
          }`}
          title="Agenda & Événements"
        >
          <Calendar size={20} />
        </button>

        {/* Tasks Toggle */}
        <button
          type="button"
          onClick={() => toggleTab('tasks')}
          className={`p-2.5 rounded-2xl transition-all ${
            activeTab === 'tasks'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
              : 'hover:bg-surface text-text-secondary hover:text-amber-400'
          }`}
          title="Devoirs & Tâches"
        >
          <ClipboardList size={20} />
        </button>

        {/* Contacts Toggle */}
        <button
          type="button"
          onClick={() => toggleTab('contacts')}
          className={`p-2.5 rounded-2xl transition-all ${
            activeTab === 'contacts'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'hover:bg-surface text-text-secondary hover:text-emerald-400'
          }`}
          title="Contacts"
        >
          <Users size={20} />
        </button>
      </div>
    </div>
  );
};
