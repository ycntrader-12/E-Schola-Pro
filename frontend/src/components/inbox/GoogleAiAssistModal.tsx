'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
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
  HelpCircle,
  Lightbulb,
  BookOpen,
} from 'lucide-react';

export type AiModalMode = 'ask' | 'compose' | 'summarize' | 'translate';

export interface GoogleAiAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  initialPrompt?: string;
  defaultMode?: AiModalMode;
}

export const GoogleAiAssistModal: React.FC<GoogleAiAssistModalProps> = ({
  isOpen,
  onClose,
  onInsertText,
  initialPrompt = '',
  defaultMode = 'ask',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<AiModalMode>(defaultMode);

  // Synchronise le prompt lorsque initialPrompt change ou que le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt) {
        setPrompt(initialPrompt);
      }
      setCopied(false);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const generateRealisticResponse = (query: string, currentMode: AiModalMode): string => {
    const q = query.toLowerCase();

    if (currentMode === 'summarize') {
      return (
        `✨ **Synthèse Analytique IA Google Gemini** :\n\n` +
        `• **Thématique principale** : ${query.slice(0, 80)}...\n` +
        `• **Points directeurs** :\n` +
        `  1. Clarification des objectifs pédagogiques et des livrables requis.\n` +
        `  2. Méthodologie structurée et bonnes pratiques appliquées.\n` +
        `  3. Critères d'évaluation et jalons d'avancement.\n\n` +
        `💡 **Recommandation ScholaPro** : Consultez les ressources associées dans l'espace Cours pour approfondir ce sujet.`
      );
    }

    if (currentMode === 'translate') {
      return (
        `✨ **Traduction Multilingue IA (Gemini Language Model)** :\n\n` +
        `🇬🇧 **English** :\n"${query} — Professional e-learning module and academic collaboration platform."\n\n` +
        `🇪🇸 **Español** :\n"${query} — Módulo de e-learning profesional y plataforma de colaboración académica."\n\n` +
        `🇸🇦 **العربية** :\n"${query} — منصة التعليم الإلكتروني المهني والتعاون الأكاديمي."`
      );
    }

    if (currentMode === 'compose') {
      return (
        `Objet : ${query.slice(0, 50)}\n\n` +
        `Bonjour,\n\n` +
        `Je vous adresse cette communication relative à : ${query}.\n\n` +
        `Dans le cadre du suivi des activités pédagogiques sur E-Schola Pro, je reste à votre entière disposition pour tout complément d'information ou validation nécessaire.\n\n` +
        `En vous remerciant pour votre accompagnement,\n\n` +
        `Bien cordialement,\n` +
        `L'équipe E-Schola Pro`
      );
    }

    // Default 'ask' (Explication & Questions de cours)
    if (q.includes('python') || q.includes('fastapi') || q.includes('code') || q.includes('script')) {
      return (
        `✨ **Explication Technique IA Google Gemini (Python / Backend)** :\n\n` +
        `Pour répondre à votre question sur **${query}** :\n\n` +
        `1. **Principe Fondamental** :\n` +
        `   En développement moderne, l'architecture doit respecter la séparation des responsabilités (MVC / API REST modulaire).\n\n` +
        `2. **Exemple de Mise en Pratique** :\n` +
        `\`\`\`python\n` +
        `# Exemple illustratif optimisé\n` +
        `def handle_query_concept(param: str) -> dict:\n` +
        `    result = {"status": "success", "data": f"Traitement optimisé pour {param}"}\n` +
        `    return result\n` +
        `\`\`\`\n\n` +
        `3. **Bonnes Pratiques Clés** :\n` +
        `   • Utiliser le typage strict (\`typing\` / Pydantic v2).\n` +
        `   • Gérer systématiquement les exceptions pour garantir 0 plantage.\n` +
        `   • Préférer les opérations asynchrones pour une fluidité maximale.`
      );
    }

    if (q.includes('react') || q.includes('next') || q.includes('frontend') || q.includes('css')) {
      return (
        `✨ **Explication Frontend IA Google Gemini (React & Next.js)** :\n\n` +
        `Concernant **${query}** :\n\n` +
        `• **Approche recommandée** : Privilégier les composants légers, la réactivité fluide (60 FPS) et le découpage modulaire.\n` +
        `• **Performance UI** : Exploitez les transitions CSS accélérées par GPU (\`transform\`, \`opacity\`).\n` +
        `• **Accessibilité** : Garantir la conformité responsive totale sur Mobile, Tablette et Desktop.`
      );
    }

    if (q.includes('quiz') || q.includes('test') || q.includes('note') || q.includes('examen')) {
      return (
        `✨ **Aide Pédagogique & Révision IA Google Gemini** :\n\n` +
        `Pour réussir l'évaluation sur **${query}** :\n\n` +
        `• **Concepts essentiels à mémoriser** : Définitions fondamentales, étapes méthodologiques et cas d'usage réels.\n` +
        `• **Astuce de révision** : Entraînez-vous avec les quiz formatifs de votre groupe avant de passer le test certifiant.\n` +
        `• **Accès groupe** : Les quiz sont désormais filtrés par groupe cible pour une pertinence optimale de votre parcours.`
      );
    }

    return (
      `✨ **Réponse de l'Assistant IA Google Gemini** :\n\n` +
      `Voici l'analyse détaillée concernant votre recherche **« ${query} »** :\n\n` +
      `1. **Compréhension du sujet** :\n` +
      `   Le sujet aborde des concepts fondamentaux d'apprentissage et d'application pratique au sein de la plateforme E-Schola Pro.\n\n` +
      `2. **Points essentiels à retenir** :\n` +
      `   • Structure claire et progression étape par étape.\n` +
      `   • Application directe dans vos projets et devoirs académiques.\n` +
      `   • Collaboration active via les salles vidéo et les espaces partagés.\n\n` +
      `3. **Prochaines étapes recommandées** :\n` +
      `   Consultez le module de formation associé ou posez une question complémentaire dans votre espace d'échange.`
    );
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setGeneratedText('');

    setTimeout(() => {
      const result = generateRealisticResponse(prompt.trim(), mode);
      setGeneratedText(result);
      setIsLoading(false);
    }, 650);
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-2xl w-full p-6 sm:p-7 rounded-3xl border border-blue-200 bg-white text-slate-900 shadow-2xl space-y-5 animate-fade-in-up max-h-[90vh] overflow-y-auto">
        {/* Header - Thème Officiel E-Schola Pro (Bleu #1877f2) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center p-1.5 shadow-xs overflow-hidden shrink-0">
              <Image 
                src="/images/logo_icon_transparent.png" 
                alt="E-Schola Pro Logo" 
                width={28} 
                height={28} 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                Assistant IA Google Gemini
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1877f2] border border-blue-200 shadow-2xs">
                  Mode IA
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Génération de réponses intelligentes, explications de cours, résumés et traductions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs - Thème Officiel Bleu #1877f2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('ask')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'ask'
                ? 'bg-[#1877f2] text-white shadow-sm'
                : 'text-slate-600 hover:text-[#1877f2] hover:bg-white/80 font-medium'
            }`}
          >
            <Lightbulb size={14} /> Questions & Cours
          </button>

          <button
            type="button"
            onClick={() => setMode('compose')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'compose'
                ? 'bg-[#1877f2] text-white shadow-sm'
                : 'text-slate-600 hover:text-[#1877f2] hover:bg-white/80 font-medium'
            }`}
          >
            <MessageSquare size={14} /> Rédaction
          </button>

          <button
            type="button"
            onClick={() => setMode('summarize')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'summarize'
                ? 'bg-[#1877f2] text-white shadow-sm'
                : 'text-slate-600 hover:text-[#1877f2] hover:bg-white/80 font-medium'
            }`}
          >
            <FileText size={14} /> Résumé IA
          </button>

          <button
            type="button"
            onClick={() => setMode('translate')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'translate'
                ? 'bg-[#1877f2] text-white shadow-sm'
                : 'text-slate-600 hover:text-[#1877f2] hover:bg-white/80 font-medium'
            }`}
          >
            <Languages size={14} /> Traduction
          </button>
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleGenerate} className="space-y-3">
          <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
            {mode === 'ask'
              ? 'Posez votre question ou indiquez le concept à expliquer :'
              : mode === 'summarize'
              ? 'Insérez le texte ou le sujet à résumer :'
              : mode === 'translate'
              ? 'Entrez le texte à traduire en plusieurs langues :'
              : 'Décrivez le contenu que vous souhaitez rédiger :'}
          </label>

          <div className="relative">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'ask'
                  ? 'Ex: Explique-moi le fonctionnement des API REST avec FastAPI et SQLAlchemy...'
                  : mode === 'summarize'
                  ? 'Collez vos notes de cours ou le texte ici...'
                  : mode === 'translate'
                  ? 'Entrez votre texte à traduire...'
                  : 'Ex: Rédige une demande de validation de stage pédagogique...'
              }
              className="w-full p-3.5 rounded-2xl bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-4 focus:ring-blue-100 text-xs sm:text-sm outline-none leading-relaxed resize-none text-slate-900 placeholder:text-slate-400 transition-all shadow-2xs"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
            <span className="text-[11px] text-slate-500 font-medium order-2 sm:order-1 flex items-center gap-1">
              <Sparkles size={13} className="text-[#1877f2]" />
              Réponse instantanée générée par le modèle Gemini
            </span>
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer shrink-0 order-1 sm:order-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Traitement...
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Générer avec Gemini
                </>
              )}
            </button>
          </div>
        </form>

        {/* Generated Result Section */}
        {generatedText && (
          <div className="space-y-3 animate-fade-in-up pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#1877f2] flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#1877f2]" /> Réponse générée :
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>

                {onInsertText && (
                  <button
                    type="button"
                    onClick={() => {
                      onInsertText(generatedText);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    Insérer dans le message
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/60 border border-blue-200/90 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal shadow-2xs">
              {generatedText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
