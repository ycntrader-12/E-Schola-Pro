'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Copy,
  Check,
  Languages,
  FileText,
  MessageSquare,
} from 'lucide-react';

export interface GoogleAiAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  initialPrompt?: string;
}

export const GoogleAiAssistModal: React.FC<GoogleAiAssistModalProps> = ({
  isOpen,
  onClose,
  onInsertText,
  initialPrompt = '',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'compose' | 'summarize' | 'translate'>('compose');

  if (!isOpen) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setGeneratedText('');

    setTimeout(() => {
      if (mode === 'summarize') {
        setGeneratedText(
          `✨ **Résumé IA Google Gemini** :\n• **Sujet principal** : Suivi des livrables et activités académiques ScholaPro.\n• **Points clés** : Validation requise des rapports de stage avant le 15 du mois.\n• **Action recommandée** : Vérifier le module Devoirs & Tâches et confirmer la réception.`
        );
      } else if (mode === 'translate') {
        setGeneratedText(
          `✨ **Traduction Multilingue IA** :\nBonjour, je vous informe que la classe virtuelle sur l'Intelligence Artificielle aura lieu cet après-midi à 14h00.`
        );
      } else {
        setGeneratedText(
          `Objet: Demande de confirmation d'accès au cours ScholaPro\n\nBonjour,\n\nJe me permets de vous contacter concernant l'accès au module de cours. Pourriez-vous svp valider ma demande afin que je puisse accéder aux ressources de formation ?\n\nEn vous remerciant par avance,\nCordialement.`
        );
      }
      setIsLoading(false);
    }, 700);
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card max-w-xl w-full p-6 rounded-2xl border border-purple-500/30 space-y-5 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-base">
            <Sparkles size={20} className="text-purple-400 animate-pulse" />
            <h3>Assistant IA Google Gemini</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-surface p-1 rounded-xl border border-border gap-1">
          <button
            type="button"
            onClick={() => setMode('compose')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'compose'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <MessageSquare size={14} /> Rédaction IA
          </button>

          <button
            type="button"
            onClick={() => setMode('summarize')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'summarize'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText size={14} /> Résumé IA
          </button>

          <button
            type="button"
            onClick={() => setMode('translate')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'translate'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Languages size={14} /> Traduction IA
          </button>
        </div>

        {/* Prompt Input */}
        <form onSubmit={handleGenerate} className="space-y-3">
          <label className="block text-xs font-bold uppercase text-text-secondary tracking-wider">
            {mode === 'summarize'
              ? 'Insérez le texte ou le message à résumer :'
              : mode === 'translate'
              ? 'Entrez le texte à traduire (Français, Anglais, Arabe...) :'
              : 'Décrivez le message que vous souhaitez générer :'}
          </label>

          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === 'summarize'
                ? 'Collez le message ici...'
                : mode === 'translate'
                ? 'Ex: Translate this email to English...'
                : 'Ex: Rédige une réponse polie confirmant ma présence à la réunion de demain...'
            }
            className="w-full p-3 rounded-xl bg-surface border border-border focus:border-purple-500 text-xs outline-none leading-relaxed resize-none text-text-primary"
          />

          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Traitement par l'IA Gemini...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Générer avec Google Gemini
              </>
            )}
          </button>
        </form>

        {/* Generated Result */}
        {generatedText && (
          <div className="space-y-3 animate-fade-in-up pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300">Résultat généré :</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover border border-border text-[11px] font-semibold text-text-primary flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>

                {onInsertText && (
                  <button
                    type="button"
                    onClick={() => {
                      onInsertText(generatedText);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors shadow-sm"
                  >
                    Insérer dans le message
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface/80 border border-purple-500/30 text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
              {generatedText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
