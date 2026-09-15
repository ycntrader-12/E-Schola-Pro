'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  Award, 
  Download, 
  Eye, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  BookOpen, 
  ExternalLink,
  Loader2
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface UserCertificate {
  id: string;
  user_id: number;
  user_name?: string;
  user_email?: string;
  assessment_id: string;
  assessment_title: string;
  attempt_id: string;
  score_percentage: number;
  certificate_file_url: string;
  issued_at: string;
}

interface AssessmentItem {
  id: string;
  title: string;
  description?: string;
  type: 'QUIZ' | 'CERTIFICATION';
  passing_score_percentage: number;
  time_limit_minutes: number;
  question_count: number;
  total_points: number;
  has_completed: boolean;
  best_score?: number;
  is_passed: boolean;
  certificate_url?: string;
}

export default function CertificationsPage() {
  const [certificates, setCertificates] = useState<UserCertificate[]>([]);
  const [certAssessments, setCertAssessments] = useState<AssessmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewCertUrl, setPreviewCertUrl] = useState<string | null>(null);

  const getCertificateUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const backendBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/api\/v1\/?$/, '');
    return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [certRes, asmRes] = await Promise.all([
          apiClient.get('/assessments/certificates/my-certificates').catch(() => ({ data: [] })),
          apiClient.get('/assessments/?type_filter=CERTIFICATION').catch(() => ({ data: [] })),
        ]);
        if (certRes?.data) setCertificates(certRes.data);
        if (asmRes?.data) setCertAssessments(asmRes.data);
      } catch (err) {
        console.error('Error loading certifications page data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-28 pb-20 max-w-7xl mx-auto space-y-10">
      {/* 1. Header & Showcase Hero */}
      <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#16325c] via-[#102444] to-[#0c1a30] text-white border border-[#2a4d7a] relative overflow-hidden shadow-2xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-12 bottom-0 opacity-15 pointer-events-none hidden lg:block">
          <GraduationCap size={260} />
        </div>

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Sparkles size={14} />
            <span>ACADÉMIE E-SCHOLA PRO • DIPLÔMES CERTIFIÉS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Espace <span className="text-amber-400">Certifications</span> & Diplômes Officiels
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Consultez vos accréditations validées, téléchargez vos diplômes haute fidélité générés automatiquement et accédez aux examens certifiants d'excellence.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/10 text-center">
              <span className="text-2xl font-black text-amber-400">{certificates.length}</span>
              <p className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">Diplôme{certificates.length > 1 ? 's' : ''} Détenu{certificates.length > 1 ? 's' : ''}</p>
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/10 text-center">
              <span className="text-2xl font-black text-white">{certAssessments.length}</span>
              <p className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">Examen{certAssessments.length > 1 ? 's' : ''} Certifiant{certAssessments.length > 1 ? 's' : ''}</p>
            </div>
            <Link
              href="/quizzes"
              className="px-5 py-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 font-sans cursor-pointer ml-auto"
            >
              <span>Accéder au Centre d'Évaluations</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Section Mes Diplômes Officiels */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <GraduationCap size={22} className="text-amber-400" />
            <h2 className="text-xl sm:text-2xl font-black text-text-primary">
              Mes Diplômes & Accréditations ({certificates.length})
            </h2>
          </div>
        </div>

        {certificates.length === 0 ? (
          <div className="p-12 rounded-3xl bg-surface border border-border text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <GraduationCap size={36} />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Aucun diplôme officiel pour le moment</h3>
            <p className="text-xs text-text-secondary max-w-lg mx-auto">
              Pour décrocher votre diplôme certifié E-Schola Pro, passez l'un des examens de certification ci-dessous et obtenez une note supérieure ou égale au seuil de passage requis (70%).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map(cert => (
              <div
                key={cert.id}
                className="rounded-3xl bg-surface border border-border overflow-hidden shadow-xl hover:border-amber-500/50 transition-all flex flex-col justify-between group"
              >
                {/* Visualisation Document */}
                <div className="relative aspect-[3/2] bg-slate-950 overflow-hidden border-b border-border">
                  <img
                    src={getCertificateUrl(cert.certificate_file_url)}
                    alt={cert.assessment_title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                    <span className="font-bold flex items-center gap-1.5 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg border border-amber-500/30">
                      <GraduationCap size={13} className="text-amber-400" />
                      Score : {cert.score_percentage}%
                    </span>
                    <span className="text-[10px] text-white/80 bg-slate-900/80 backdrop-blur px-2 py-1 rounded-md">
                      {new Date(cert.issued_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Métadonnées & Actions */}
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-black text-text-primary line-clamp-1">
                      {cert.assessment_title}
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">
                      Récipiendaire : <strong className="text-text-primary">{cert.user_name || cert.user_email}</strong>
                    </p>
                    <p className="text-[10px] font-mono text-text-muted mt-0.5">
                      Vérification : CERT-{cert.id.substring(0, 12).toUpperCase()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <a
                      href={getCertificateUrl(cert.certificate_file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer"
                    >
                      <Download size={14} /> Télécharger HD
                    </a>
                    <button
                      type="button"
                      onClick={() => setPreviewCertUrl(cert.certificate_file_url)}
                      className="p-2.5 rounded-xl border border-border hover:bg-surface-raised text-text-secondary hover:text-text-primary cursor-pointer"
                      title="Aperçu Plein Écran"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Section Examens de Certification Disponibles */}
      <div className="space-y-6 pt-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Award size={22} className="text-primary" />
            <h2 className="text-xl sm:text-2xl font-black text-text-primary">
              Examens de Certification Officiels ({certAssessments.length})
            </h2>
          </div>
        </div>

        {certAssessments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface border border-border text-center text-xs text-text-secondary">
            Aucun examen certifiant n'est actuellement programmé pour votre promotion.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certAssessments.map(asm => (
              <div
                key={asm.id}
                className="p-6 rounded-3xl bg-surface border border-border hover:border-primary/40 transition-all flex flex-col justify-between space-y-6 shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <GraduationCap size={12} /> Certification
                    </span>
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Clock size={12} /> {asm.time_limit_minutes || 30} min
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-text-primary leading-snug">
                    {asm.title}
                  </h3>

                  {asm.description && (
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      {asm.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <div className="p-2 rounded-xl bg-surface-raised border border-border text-center">
                      <span className="text-[10px] uppercase font-bold text-text-muted">Seuil Minimal</span>
                      <p className="font-extrabold text-emerald-400">{asm.passing_score_percentage}%</p>
                    </div>
                    <div className="p-2 rounded-xl bg-surface-raised border border-border text-center">
                      <span className="text-[10px] uppercase font-bold text-text-muted">Épreuves</span>
                      <p className="font-extrabold text-text-primary">{asm.question_count} question{asm.question_count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Link
                    href="/quizzes"
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-all cursor-pointer"
                  >
                    <span>Passer l'Examen de Certification</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Modal d'Aperçu Grand Format du Diplôme */}
      {previewCertUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <GraduationCap size={16} /> Diplôme Officiel E-Schola Pro (Haute Résolution)
              </span>
              <button
                type="button"
                onClick={() => setPreviewCertUrl(null)}
                className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-raised cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-border aspect-[3/2] bg-slate-950">
              <img
                src={getCertificateUrl(previewCertUrl)}
                alt="Aperçu du diplôme"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <a
                href={getCertificateUrl(previewCertUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Download size={14} /> Télécharger le diplôme original (PNG)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
