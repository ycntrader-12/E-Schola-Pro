'use client';

import React, { useState, useEffect } from 'react';
import GoogleAiAssistModal from '@/components/inbox/GoogleAiAssistModal';

/**
 * GlobalAiAssistant
 * 
 * Composant d'écoute global permettant d'ouvrir l'Assistant IA Google Gemini 
 * depuis n'importe quelle page (Navbar, Sidebar, Dashboard, Cours, Quiz, etc.)
 * pour TOUS les utilisateurs sans exception de rôle (Étudiant, Stagiaire, Formateur, Admin).
 */
export default function GlobalAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [mode, setMode] = useState<'ask' | 'compose' | 'summarize' | 'translate'>('ask');
  const [prompt, setPrompt] = useState<string>('');

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e?.detail?.courseId !== undefined) {
        setCourseId(e.detail.courseId);
      } else {
        setCourseId(null);
      }
      if (e?.detail?.mode) {
        setMode(e.detail.mode);
      } else {
        setMode('ask');
      }
      if (e?.detail?.prompt) {
        setPrompt(e.detail.prompt);
      } else {
        setPrompt('');
      }
      setIsOpen(true);
    };

    window.addEventListener('open_ai_assistant', handleOpen);
    return () => {
      window.removeEventListener('open_ai_assistant', handleOpen);
    };
  }, []);

  return (
    <GoogleAiAssistModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      defaultCourseId={courseId}
      defaultMode={mode}
      initialPrompt={prompt}
    />
  );
}
