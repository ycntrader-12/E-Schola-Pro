'use client';

import { useState, useEffect } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import Image from 'next/image';
import {
  Monitor,
  Globe,
  Sparkles,
  Shield,
  ShieldCheck,
  UserCheck,
  Briefcase,
  GraduationCap,
  Users,
  Folder,
  LayoutDashboard,
  Inbox,
  Award,
  Calendar,
  Video,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Zap,
  Server,
  Database,
  Lock,
  ArrowRight,
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import BackButton from '@/components/BackButton';

interface DemoAccount {
  roleName: string;
  roleKey: string;
  badge: string;
  color: string;
  username: string;
  email: string;
  password: string;
  description: string;
  permissions: string[];
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    roleName: 'Super-Administrateur Racine',
    roleKey: 'admin',
    badge: '👑 Root Admin (Intouchable)',
    color: 'from-blue-600 to-indigo-700',
    username: 'admin_first',
    email: 'admin_first@eschola.pro',
    password: 'Admin@1212',
    description: 'Privilèges absolus, accès à la console Active Directory, au panneau système et à la supervision.',
    permissions: ['Tous les modules', 'Gestion Active Directory', 'SQLAdmin', 'Mode Panoramique 4K']
  },
  {
    roleName: 'Administrateur Central',
    roleKey: 'admin',
    badge: '🛡️ Admin Gouvernance',
    color: 'from-indigo-600 to-blue-700',
    username: 'admin',
    email: 'admin@eschola.pro',
    password: 'Abc1234',
    description: 'Gestion des utilisateurs, des cours, des examens certifiants et des groupes d’étudiants.',
    permissions: ['Catalogue Cours', 'Gestion des Utilisateurs', 'Évaluations & Devoirs', 'Messagerie']
  },
  {
    roleName: 'Enseignant / Formateur Référent',
    roleKey: 'formateur',
    badge: '👨‍🏫 Formateur / Professeur',
    color: 'from-violet-600 to-purple-700',
    username: 'formateur',
    email: 'formateur@eschola.pro',
    password: 'Abc1234',
    description: 'Gestion pédagogique : création de cours, animation des visioconférences, notation des devoirs et émargement.',
    permissions: ['Création de Cours & Vidéos', 'Gestion des Groupes', 'Correction des Devoirs', 'Salles Vidéo Jitsi']
  },
  {
    roleName: 'Direction Générale & RH',
    roleKey: 'dg_rh',
    badge: '👔 Direction / RH',
    color: 'from-amber-600 to-orange-600',
    username: 'dgrh_test',
    email: 'dgrh@eschola.pro',
    password: 'Abc1234',
    description: 'Supervision des formations, suivi des compétences et des effectifs salariés.',
    permissions: ['Accès Groupes & Classes', 'Rapports & Certifications', 'Messagerie RH']
  },
  {
    roleName: 'Salarié / Formation Continue',
    roleKey: 'employer',
    badge: '💼 Employé Entreprise',
    color: 'from-emerald-600 to-teal-700',
    username: 'alami.salma',
    email: 'alami.salma@eschola.pro',
    password: 'Abc1234',
    description: 'Profil d’apprenant en entreprise : accès aux cours, devoirs et certifications officielles.',
    permissions: ['Cours & Vidéos', 'Rendu de Devoirs', 'Quiz Formatifs', 'Certifications']
  },
  {
    roleName: 'Étudiant / Formation Initiale',
    roleKey: 'étudiant',
    badge: '🎓 Étudiant Académique',
    color: 'from-sky-600 to-cyan-700',
    username: 'student_test_1',
    email: 'student_test_1@eschola.pro',
    password: 'Abc1234',
    description: 'Apprenant régulier : suivi de cours en mode panoramique, passage de quiz et remise de livrables.',
    permissions: ['Cours & Vidéos HD', 'Recherche Google Web', 'Dépôt de Livrables', 'Salle Vidéo']
  }
];

interface ModuleCard {
  id: string;
  title: string;
  href: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  description: string;
  highlight?: boolean;
}

const MODULE_CARDS: ModuleCard[] = [
  {
    id: 'courses_panoramic',
    title: 'Cours & Vidéos (Mode Panoramique Large)',
    href: '/courses',
    icon: Monitor,
    badge: 'Nouveau • Widescreen 100%',
    badgeColor: 'bg-blue-50 text-[#1877f2] border-blue-200',
    description: 'Explorateur de cours ultra-large avec commutateur panoramique, dossiers dépliables et lecteur vidéo 16:9.',
    highlight: true
  },
  {
    id: 'google_integrated',
    title: 'Recherche Google Web Intégrée (0 Redirection)',
    href: '/courses?engine=google&q=next.js+react',
    icon: Globe,
    badge: 'Nouveau • Sans Sortie Externe',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Moteur Google live encapsulé dans un cadre sécurisé avec fiches de savoirs et suggestions instantanées.',
    highlight: true
  },
  {
    id: 'dashboard',
    title: 'Tableau de Bord & KPIs',
    href: '/dashboard',
    icon: LayoutDashboard,
    badge: 'Hub Central',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Vue d’ensemble des activités, cours récents, raccourcis de navigation et métriques personnelles.'
  },
  {
    id: 'profile_ad',
    title: 'Profil & Console Active Directory (RBAC)',
    href: '/profile',
    icon: ShieldCheck,
    badge: 'Sécurité & Annuaire',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Gestion des objets Active Directory, rôles, réinitialisation de mot de passe et informations de compte.'
  },
  {
    id: 'inbox',
    title: 'ScholaPro Inbox (Messagerie Sécurisée)',
    href: '/inbox',
    icon: Inbox,
    badge: 'Communication',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Boîte de réception inspirée de Gmail avec recherche multi-modes, copie carbone et pièces jointes.'
  },
  {
    id: 'certifications',
    title: 'Évaluations & Certifications Officielles',
    href: '/certifications',
    icon: Award,
    badge: 'Diplômes & Quiz',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Passage d’examens certifiants, génération automatique de diplômes PDF avec signature sécurisée.'
  },
  {
    id: 'assignments',
    title: 'Devoirs, Tâches & Livrables Officiels',
    href: '/tasks',
    icon: FileCheck,
    badge: 'Évaluations',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    description: 'Dépôt de devoirs, suivi des échéances, notification automatique et notation sur 20 par les formateurs.'
  },
  {
    id: 'group',
    title: 'Groupes & Classes Pédagogiques',
    href: '/group',
    icon: Users,
    badge: 'Collaboration',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Gestion des promotions, répartition des apprenants et communication de groupe ciblée.'
  },
  {
    id: 'calendar',
    title: 'Calendrier & Emploi du Temps',
    href: '/calendar',
    icon: Calendar,
    badge: 'Planning',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Planification des cours, sessions de révision et synchronisation des échéances de livrables.'
  },
  {
    id: 'classroom',
    title: 'Salles Vidéo Conférence (WebRTC / UDP)',
    href: '/classroom',
    icon: Video,
    badge: 'Direct Live',
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
    description: 'Classes virtuelles interactives avec partage d’écran, chat en temps réel et signal lumineux d’activité.'
  },
  {
    id: 'admin',
    title: 'Console Administration & Supervision',
    href: '/admin',
    icon: Shield,
    badge: 'Réservé Admin',
    badgeColor: 'bg-slate-900 text-white border-slate-900',
    description: 'Supervision globale de la sécurité, gestion des permissions, statut des flux et audit.'
  }
];

export default function DemoPage() {
  const router = useRouter();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loggingInKey, setLoggingInKey] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [currentConnectedUser, setCurrentConnectedUser] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Vérification de la connectivité Backend
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const meRes = await apiClient.get('/users/me');
          if (meRes.data) {
            setCurrentConnectedUser(`${meRes.data.username || meRes.data.email} (${meRes.data.role})`);
          }
        }
        setBackendStatus('online');
      } catch (e: any) {
        // Même sans auth, un 401 signifie que le backend répond !
        if (e?.response?.status === 401 || e?.response?.status === 403 || e?.response?.status === 200) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      }
    };
    checkBackend();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Connexion express en 1 clic
  const handleQuickLogin = async (acc: DemoAccount, redirectPath: string = '/dashboard') => {
    setLoggingInKey(acc.username);
    setActionSuccessMsg(null);
    try {
      const res = await apiClient.post('/login/access-token', {
        username: acc.username || acc.email,
        email: acc.email,
        password: acc.password
      });

      const token = res.data.access_token;
      localStorage.setItem('access_token', token);
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      document.cookie = `access_token=${token}; path=/; max-age=86400; SameSite=Lax${isHttps ? '; Secure' : ''}`;

      try {
        const parts = token.split('.');
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(decodeURIComponent(escape(atob(base64))));
        if (payload.role) {
          localStorage.setItem('user_role', String(payload.role).trim().toLowerCase());
        }
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth_update'));
        window.dispatchEvent(new Event('storage'));
      }

      setCurrentConnectedUser(`${acc.username} (${acc.roleKey})`);
      setActionSuccessMsg(`Connecté avec succès en tant que ${acc.roleName} ! Redirection en cours...`);

      setTimeout(() => {
        router.push(redirectPath);
      }, 700);
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la connexion automatique. Vérifiez que le backend FastAPI est démarré sur http://127.0.0.1:8000.");
    } finally {
      setLoggingInKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-10 space-y-10">
      
      {/* 1. TOP HEADER & STATUS BAR */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <BackButton />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Portail Démo &amp; Banc d’Essai • <span className="text-[#1877f2]">E-Schola Pro</span>
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1877f2] font-black text-[11px] border border-blue-200">
                v2.5 Pro
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Espace dédié aux tests complets : Mode Panoramique, Google Web Intégré, Authentification RBAC et tous les 15 modules.
            </p>
          </div>
        </div>

        {/* Server Status Indicators */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Frontend : <strong>3000 (Actif)</strong></span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
            <span className={`w-2.5 h-2.5 rounded-full ${backendStatus === 'online' ? 'bg-emerald-500' : backendStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
            <span>Backend : <strong>{backendStatus === 'online' ? '8000 (En ligne)' : backendStatus === 'offline' ? '8000 (Hors-ligne)' : 'Vérification...'}</strong></span>
          </div>

          {currentConnectedUser && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#1877f2] border border-blue-200 text-xs font-bold">
              <UserCheck size={14} />
              <span>Session : <strong>{currentConnectedUser}</strong></span>
            </div>
          )}
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="max-w-7xl mx-auto p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 2. SECTION VEDETTE : LES NOUVEAUTÉS DEMANDÉES (PANORAMIQUE & GOOGLE INTÉGRÉ) */}
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="text-[#1877f2]" size={18} />
            <span>Dernières Nouveautés Prêtes au Test Direct</span>
          </h2>
          <span className="text-xs text-slate-500 font-semibold">Test immédiat sans formulaire</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 : Format Large Mode Panoramique */}
          <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 text-white p-7 rounded-3xl border border-blue-800/40 shadow-lg space-y-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Monitor size={140} />
            </div>
            <div className="space-y-3 z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-extrabold uppercase">
                <Monitor size={13} />
                <span>Format Large • Widescreen 100%</span>
              </div>
              <h3 className="text-xl font-black">Mode Panoramique 4K des Cours</h3>
              <p className="text-xs text-blue-100/80 leading-relaxed max-w-md">
                L’interface de la bibliothèque s’élargit jusqu’à 1850px avec jusqu’à 5 colonnes de cours sur grands écrans et un lecteur vidéo modal au format cinéma 16:9 panoramique.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between z-10">
              <span className="text-xs text-blue-200 font-medium">Route : <code>/fr/courses</code></span>
              <Link
                href="/courses"
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <span>Ouvrir en Mode Panoramique</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 2 : Google Web 100% Intégré */}
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white p-7 rounded-3xl border border-emerald-800/40 shadow-lg space-y-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe size={140} />
            </div>
            <div className="space-y-3 z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-extrabold uppercase">
                <Globe size={13} />
                <span>Zéro Sortie Externe • 100% Inclus</span>
              </div>
              <h3 className="text-xl font-black">Moteur Google Web Intégré dans l’App</h3>
              <p className="text-xs text-emerald-100/80 leading-relaxed max-w-md">
                Effectuez des recherches sur Google directement au sein de la page via un cadre de navigation panoramique sécurisé, sans ouvrir d'onglets externes ni quitter E-Schola Pro.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between z-10">
              <span className="text-xs text-emerald-200 font-medium">Route : <code>/fr/courses?engine=google</code></span>
              <Link
                href="/courses?engine=google&q=next.js+react"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <span>Tester la Recherche Google</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONNEXION EXPRESS EN 1 CLIC PAR RÔLE (RBAC TEST BENCH) */}
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Shield className="text-[#1877f2]" size={18} />
              <span>Comptes Démo Prêts à l'Emploi &amp; Connexion Express (1 Clic)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Cliquez sur « Connexion Express » pour vous authentifier immédiatement sous le rôle de votre choix sans saisir de mot de passe.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_ACCOUNTS.map((acc) => (
            <div
              key={acc.username}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-blue-300 transition-all"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">{acc.roleName}</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {acc.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">{acc.description}</p>

                {/* Credentials capsule */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Email :</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(acc.email, `${acc.username}_email`)}
                      className="font-bold text-slate-800 flex items-center gap-1 hover:text-[#1877f2] cursor-pointer"
                      title="Copier l'email"
                    >
                      <span>{acc.email}</span>
                      <Copy size={11} className={copiedKey === `${acc.username}_email` ? 'text-green-600' : 'text-slate-400'} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Mot de passe :</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(acc.password, `${acc.username}_pwd`)}
                      className="font-bold text-slate-800 flex items-center gap-1 hover:text-[#1877f2] cursor-pointer"
                      title="Copier le mot de passe"
                    >
                      <span>{acc.password}</span>
                      <Copy size={11} className={copiedKey === `${acc.username}_pwd` ? 'text-green-600' : 'text-slate-400'} />
                    </button>
                  </div>
                </div>

                {/* Permissions tags */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {acc.permissions.map((p) => (
                    <span key={p} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      ✓ {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={loggingInKey === acc.username}
                onClick={() => handleQuickLogin(acc)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-[#1877f2] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {loggingInKey === acc.username ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} className="text-amber-300" />
                    <span>Connexion Express 1 Clic</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. MATRICE COMPLÈTE DE TEST DES 15 MODULES DE L'APPLICATION */}
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Folder className="text-[#1877f2]" size={18} />
              <span>Matrice Complète des Modules &amp; Liens Directs</span>
            </h2>
            <p className="text-xs text-slate-500">
              Accédez directement à chaque écran de l’application pour vérifier le comportement en situation réelle.
            </p>
          </div>
          <span className="text-xs font-bold text-[#1877f2] bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
            {MODULE_CARDS.length} Modules Référencés
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MODULE_CARDS.map((mod) => {
            const ModIcon = mod.icon;
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-3 group ${
                  mod.highlight
                    ? 'bg-white border-blue-300 shadow-md ring-1 ring-blue-500/15 hover:border-blue-500 hover:scale-[1.01]'
                    : 'bg-white border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1877f2] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ModIcon size={20} />
                    </div>
                    {mod.badge && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${mod.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                        {mod.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-[#1877f2] transition-colors leading-snug">
                    {mod.title}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-[#1877f2] font-bold">
                  <span className="font-mono text-[11px] text-slate-400 group-hover:text-[#1877f2] transition-colors truncate max-w-[170px]">
                    {mod.href}
                  </span>
                  <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Ouvrir</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 5. LIENS SYSTÈME, BACKEND API & DOCUMENTATION TECHNIQUE */}
      <div className="max-w-7xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900 text-white space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-black flex items-center gap-2">
              <Database className="text-blue-400" size={18} />
              <span>Services d’Administration Système, Backend &amp; Documentation</span>
            </h3>
            <p className="text-xs text-slate-400">
              Liens techniques pour tester les endpoints REST OpenAPI, le panneau SQLAdmin et la documentation de référence.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
          {/* Swagger OpenAPI */}
          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Server size={18} className="text-emerald-400" />
              <div>
                <p className="text-white font-extrabold">Documentation Swagger</p>
                <p className="text-[11px] text-slate-400 font-mono">http://127.0.0.1:8000/docs</p>
              </div>
            </div>
            <ExternalLink size={14} className="text-slate-400 group-hover:text-white transition-colors" />
          </a>

          {/* SQLAdmin */}
          <a
            href="http://127.0.0.1:8000/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Database size={18} className="text-blue-400" />
              <div>
                <p className="text-white font-extrabold">SQLAdmin (Base de Données)</p>
                <p className="text-[11px] text-slate-400 font-mono">http://127.0.0.1:8000/admin</p>
              </div>
            </div>
            <ExternalLink size={14} className="text-slate-400 group-hover:text-white transition-colors" />
          </a>

          {/* Documentation Technique HTML */}
          <a
            href="/Documentation_Technique_E-Schola_Pro.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-amber-400" />
              <div>
                <p className="text-white font-extrabold">Documentation Technique HTML</p>
                <p className="text-[11px] text-slate-400 font-mono">Spécifications complètes</p>
              </div>
            </div>
            <ExternalLink size={14} className="text-slate-400 group-hover:text-white transition-colors" />
          </a>
        </div>
      </div>

    </div>
  );
}
