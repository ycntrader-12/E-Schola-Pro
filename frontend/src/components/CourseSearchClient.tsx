'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import {
  BookOpen,
  Star,
  Users,
  Search,
  Folder,
  FolderOpen,
  Film,
  PlayCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  LayoutGrid,
  Clock,
  ArrowRight,
  Globe,
  Monitor,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Compass,
  Bookmark,
  Share2,
  CheckCircle2,
  Layers,
  Zap,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import CreateCourseButton from '@/components/CreateCourseButton';
import UploadVideoButton from '@/components/UploadVideoButton';
import BackButton from '@/components/BackButton';
import YoutubePlayer from '@/components/video/YoutubePlayer';
import DownloadCourseButton from '@/components/DownloadCourseButton';
import { apiClient } from '@/lib/api';

export interface CourseVideo {
  id: number;
  course_id?: number;
  title: string;
  description?: string | null;
  video_url: string;
  order_index?: number;
  created_at?: string;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  cover_image_url?: string;
  document_url?: string;
  instructor_id: number;
  instructor?: { id?: number; email: string; nom?: string; prenom?: string };
  videos?: CourseVideo[];
}

interface CourseSearchClientProps {
  initialCourses: Course[];
}

const QUICK_TOPICS = [
  { label: 'Next.js 15 & React', query: 'next.js 15 app router react tutorial' },
  { label: 'FastAPI & Python', query: 'fastapi python rest api documentation' },
  { label: 'IA & Machine Learning', query: 'intelligence artificielle python machine learning cours' },
  { label: 'Docker & DevOps', query: 'docker containers deploiement tutoriel' },
  { label: 'Cybersécurité OWASP', query: 'cybersecurite securite applicative web owasp' },
  { label: 'SQLAlchemy & SQLite', query: 'sqlalchemy 2.0 python orm guide' },
  { label: 'TailwindCSS & Design UI', query: 'tailwindcss modern ui components responsive' },
];

export default function CourseSearchClient({ initialCourses }: CourseSearchClientProps) {
  const searchParams = useSearchParams();

  const [courses, setCourses] = useState<Course[]>(initialCourses || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchEngine, setSearchEngine] = useState<'app' | 'google'>('app');
  const [viewMode, setViewMode] = useState<'folders' | 'grid'>('folders');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Format Large & Mode Panoramique (par défaut actif pour haute lisibilité)
  const [isPanoramic, setIsPanoramic] = useState<boolean>(true);

  // Gestion des résultats Google 100% Intégrés (Zéro redirection externe)
  const [activeGoogleQuery, setActiveGoogleQuery] = useState<string>('formation e-learning programmation');
  const [googleSubTab, setGoogleSubTab] = useState<'live' | 'knowledge' | 'platform'>('live');
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [isIframeLoading, setIsIframeLoading] = useState<boolean>(false);
  const [googleFrameHeight, setGoogleFrameHeight] = useState<'compact' | 'panoramic' | 'cinema'>('panoramic');

  // Suivi de l'état ouvert/replié des dossiers de cours
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});

  // Lecteur vidéo modal HD interactif
  const [activeModalVideo, setActiveModalVideo] = useState<{
    video: CourseVideo;
    course: Course;
    videoIndex: number;
  } | null>(null);

  // Synchronisation avec les paramètres d'URL (ex: depuis le dashboard /courses?engine=google&q=...)
  useEffect(() => {
    if (!searchParams) return;
    const engineParam = searchParams.get('engine');
    const qParam = searchParams.get('q');
    if (engineParam === 'google') {
      setSearchEngine('google');
    }
    if (qParam && qParam.trim()) {
      setSearchQuery(qParam.trim());
      setActiveGoogleQuery(qParam.trim());
      setIsIframeLoading(true);
    }
  }, [searchParams]);

  // Actualisation dynamique côté client pour garantir la cohérence en temps réel avec la BDD
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await apiClient.get('/courses/');
        if (res.data && Array.isArray(res.data)) {
          setCourses(res.data);
          const initialOpen: Record<number, boolean> = {};
          res.data.forEach((c: Course) => {
            initialOpen[c.id] = true;
          });
          setOpenFolders(initialOpen);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des cours :", err);
      }
    };
    fetchCourses();
  }, []);

  const toggleFolder = (courseId: number) => {
    setOpenFolders((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  const expandAllFolders = () => {
    const allOpen: Record<number, boolean> = {};
    courses.forEach((c) => {
      allOpen[c.id] = true;
    });
    setOpenFolders(allOpen);
  };

  const collapseAllFolders = () => {
    setOpenFolders({});
  };

  // Soumission de la recherche : ZÉRO window.open, résultats 100% intégrés
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchEngine === 'google') {
      const q = searchQuery.trim() || 'formation e-learning programmation';
      setActiveGoogleQuery(q);
      setIsIframeLoading(true);
      setIframeKey((k) => k + 1);
    }
  };

  const handleSelectQuickTopic = (q: string) => {
    setSearchQuery(q);
    setActiveGoogleQuery(q);
    setIsIframeLoading(true);
    setIframeKey((k) => k + 1);
  };

  const categories = useMemo(() => [
    { id: 'all', label: 'Tous les dossiers' },
    { id: 'web', label: 'Web & Fullstack', match: ['next.js', 'react', 'web', 'javascript', 'frontend'] },
    { id: 'backend', label: 'Python & APIs', match: ['fastapi', 'python', 'api', 'backend', 'rest'] },
    { id: 'ai', label: 'IA & Data Science', match: ['intelligence', 'machine learning', 'data', 'pandas', 'scikit'] },
    { id: 'security', label: 'Cybersécurité & Réseaux', match: ['sécurité', 'cyber', 'réseau', 'owasp', 'tls'] },
  ], []);

  // Filtrage des cours internes selon la recherche
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (searchEngine === 'google') return true;

      if (selectedCategory !== 'all') {
        const cat = categories.find((c) => c.id === selectedCategory);
        if (cat?.match) {
          const text = `${course.title} ${course.description}`.toLowerCase();
          const matchesCat = cat.match.some((keyword) => text.includes(keyword.toLowerCase()));
          if (!matchesCat) return false;
        }
      }

      if (!searchQuery.trim()) return true;
      const lower = searchQuery.toLowerCase();
      const matchCourse =
        course.title.toLowerCase().includes(lower) ||
        (course.description && course.description.toLowerCase().includes(lower)) ||
        (course.instructor?.email && course.instructor.email.toLowerCase().includes(lower));

      const matchVideos = course.videos?.some(
        (v) =>
          v.title.toLowerCase().includes(lower) ||
          (v.description && v.description.toLowerCase().includes(lower))
      );

      return matchCourse || matchVideos;
    });
  }, [courses, searchQuery, searchEngine, selectedCategory, categories]);

  // Cours internes correspondant à la recherche Google active
  const matchingPlatformCourses = useMemo(() => {
    const q = (activeGoogleQuery || searchQuery).toLowerCase().trim();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length === 0) return courses.slice(0, 3);

    return courses.filter((c) => {
      const text = `${c.title} ${c.description || ''}`.toLowerCase();
      return tokens.some((token) => text.includes(token));
    });
  }, [courses, activeGoogleQuery, searchQuery]);

  const totalCourses = courses.length;
  const totalVideos = courses.reduce((acc, c) => acc + (c.videos?.length || 0), 0);

  // Hauteur dynamique du cadre Google Web
  const frameHeightClass =
    googleFrameHeight === 'compact'
      ? 'h-[620px]'
      : googleFrameHeight === 'cinema'
      ? 'h-[980px]'
      : 'h-[780px]';

  return (
    <div
      className={`min-h-screen py-16 sm:py-20 transition-all duration-300 space-y-8 ${
        isPanoramic ? 'w-full max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12' : 'max-w-7xl mx-auto px-4'
      }`}
    >
      {/* 1. BARRE DE COMMANDE SUPÉRIEURE & CONTRÔLEUR PANORAMIQUE */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackButton className="mb-0" />

        {/* Commutateur de Mode Panoramique Widescreen */}
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setIsPanoramic(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !isPanoramic
                ? 'bg-slate-100 text-slate-800 shadow-2xs font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Affichage Standard (Largeur 7xl)"
          >
            <Minimize2 size={14} />
            <span className="hidden sm:inline">Standard</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPanoramic(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              isPanoramic
                ? 'bg-[#1877f2] text-white shadow-xs shadow-blue-500/25 ring-1 ring-blue-400/40'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Format Large Mode Panoramique (Widescreen 100%)"
          >
            <Monitor size={14} />
            <span>Mode Panoramique Large</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider">
              HD
            </span>
          </button>
        </div>
      </div>

      {/* 2. EN-TÊTE PANORAMIQUE & MOTEUR DE RECHERCHE UNIFIÉ */}
      <div className="flex flex-col items-center text-center p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-blue-50/70 via-white to-slate-50/50 border border-slate-200 shadow-sm space-y-6">
        {/* Badge Thème */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#1877f2] font-extrabold text-xs shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#1877f2] animate-pulse" />
          <span>Campus Numérique • Recherche Panoramique Multi-Moteurs</span>
          {isPanoramic && (
            <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black tracking-wide">
              PANORAMIQUE
            </span>
          )}
        </div>

        {/* Titre & Sous-titre */}
        <div className="space-y-3 max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Dossiers de Cours & <span className="bg-gradient-to-r from-[#1877f2] via-[#2563eb] to-[#0052cc] bg-clip-text text-transparent">Recherche Intégrée</span>
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            Explorez notre bibliothèque académique organisée par dossiers thématiques ou interrogez le moteur Google Web en mode intégré directement dans l'interface sans quitter la plateforme.
          </p>
        </div>

        {/* Métriques */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <Folder className="w-4 h-4 text-[#1877f2]" />
            <strong>{totalCourses}</strong> {totalCourses > 1 ? 'Dossiers de cours' : 'Dossier de cours'}
          </span>
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <Film className="w-4 h-4 text-emerald-600" />
            <strong>{totalVideos}</strong> {totalVideos > 1 ? 'Vidéos de formation' : 'Vidéo de formation'}
          </span>
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs font-extrabold">
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>Google Web Intégré (0 Redirection externe)</span>
          </span>
        </div>

        {/* ONGLETS DE RECHERCHE : Catalogue Interne vs Google Web Intégré */}
        <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto pt-2">
          {/* Les 2 Onglets Principaux */}
          <div className="flex items-center justify-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200 shadow-2xs w-full">
            <button
              type="button"
              onClick={() => setSearchEngine('app')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer ${
                searchEngine === 'app'
                  ? 'bg-white text-[#1877f2] shadow-xs font-black ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 font-bold'
              }`}
            >
              <Folder size={15} className={searchEngine === 'app' ? 'text-[#1877f2]' : 'text-slate-400'} />
              <span>Catalogue E-Schola ({courses.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchEngine('google');
                if (!activeGoogleQuery) {
                  setActiveGoogleQuery(searchQuery.trim() || 'formation e-learning programmation');
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer ${
                searchEngine === 'google'
                  ? 'bg-[#1877f2] text-white shadow-xs font-black shadow-blue-500/30 ring-1 ring-blue-400/40'
                  : 'text-slate-600 hover:text-slate-900 font-bold'
              }`}
            >
              <Globe size={15} />
              <span>Google Web Intégré</span>
              <span className="text-[9px] bg-emerald-500 text-white font-black px-1.5 py-0.2 rounded-md uppercase">
                Inclus
              </span>
            </button>
          </div>

          {/* Formulaire de saisie unifié */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center w-full shadow-sm rounded-2xl overflow-hidden border border-slate-200 bg-white focus-within:border-[#1877f2] focus-within:ring-2 focus-within:ring-blue-100 transition-all"
          >
            <div className="relative flex-1 flex items-center">
              {searchEngine === 'google' ? (
                <Globe className="absolute left-4 text-[#1877f2]" size={18} />
              ) : (
                <Search className="absolute left-4 text-slate-400" size={18} />
              )}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  searchEngine === 'app'
                    ? "Rechercher cours, vidéo, technologie, compétence..."
                    : "Rechercher sur Google Web (résultats intégrés dans la page)..."
                }
                className="w-full pl-11 pr-4 py-3 bg-transparent text-slate-900 placeholder:text-slate-400 outline-none text-xs sm:text-sm font-medium"
              />
            </div>

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Effacer"
              >
                <X size={16} />
              </button>
            )}

            <button
              type="submit"
              className="bg-[#1877f2] hover:bg-[#166fe5] text-white px-5 py-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              {searchEngine === 'google' ? (
                <>
                  <Globe size={15} />
                  <span className="hidden sm:inline">Chercher sur Google</span>
                </>
              ) : (
                <>
                  <Search size={15} />
                  <span className="hidden sm:inline">Rechercher</span>
                </>
              )}
            </button>
          </form>

          {/* Boutons d'actions rapides (Upload & Création de cours) */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <UploadVideoButton courses={courses} />
            <CreateCourseButton />
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. CAS A : MOTEUR GOOGLE WEB INTÉGRÉ (MODE PANORAMIQUE • 0 SORTIE EXTERNE) */}
      {/* ======================================================================= */}
      {searchEngine === 'google' ? (
        <div className="space-y-6 animate-fade-in">
          {/* En-tête Panoramique du Navigateur Web Intégré */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Barre de navigation style navigateur web avec contrôles */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Point lumineux et titre */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                </div>
                <div className="h-4 w-px bg-white/20 mx-1" />
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-blue-400" />
                  <span className="text-xs font-black tracking-wide text-white">Google Search Panoramique</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-bold border border-emerald-500/30 uppercase">
                    Intégré dans E-Schola Pro
                  </span>
                </div>
              </div>

              {/* Barre d'URL sécurisée */}
              <div className="flex-1 max-w-xl mx-auto w-full">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-white/15 text-xs text-slate-300 font-mono overflow-hidden">
                  <span className="text-emerald-400 text-xs">🔒</span>
                  <span className="truncate text-[11px] text-slate-300">
                    https://www.google.com/search?igu=1&amp;q={encodeURIComponent(activeGoogleQuery)}
                  </span>
                </div>
              </div>

              {/* Actions du cadre : Rafraîchir, Hauteur, Plein écran */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsIframeLoading(true);
                    setIframeKey((k) => k + 1);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Rafraîchir les résultats Google"
                >
                  <RefreshCw size={14} className={isIframeLoading ? 'animate-spin text-blue-400' : ''} />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>

                {/* Contrôleur de hauteur panoramique */}
                <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/10 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setGoogleFrameHeight('compact')}
                    className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      googleFrameHeight === 'compact' ? 'bg-white text-slate-900 font-black' : 'text-slate-300'
                    }`}
                    title="Hauteur Compacte (620px)"
                  >
                    620px
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoogleFrameHeight('panoramic')}
                    className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      googleFrameHeight === 'panoramic' ? 'bg-white text-slate-900 font-black' : 'text-slate-300'
                    }`}
                    title="Hauteur Panoramique (780px)"
                  >
                    Panoramique
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoogleFrameHeight('cinema')}
                    className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      googleFrameHeight === 'cinema' ? 'bg-white text-slate-900 font-black' : 'text-slate-300'
                    }`}
                    title="Hauteur Cinéma 4K (980px)"
                  >
                    Plein écran
                  </button>
                </div>
              </div>
            </div>

            {/* Chips de requêtes rapides Google */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 shrink-0 flex items-center gap-1">
                <Sparkles size={12} className="text-[#1877f2]" /> Recherches rapides :
              </span>
              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic.label}
                  type="button"
                  onClick={() => handleSelectQuickTopic(topic.query)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeGoogleQuery === topic.query
                      ? 'bg-[#1877f2] text-white shadow-2xs font-bold'
                      : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-[#1877f2] border border-slate-200'
                  }`}
                >
                  {topic.label}
                </button>
              ))}
            </div>

            {/* Sous-Onglets de la Vue Google Intégrée */}
            <div className="px-5 pt-3 pb-0 bg-white border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGoogleSubTab('live')}
                  className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                    googleSubTab === 'live'
                      ? 'border-[#1877f2] text-[#1877f2] font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Globe size={15} />
                  <span>Cadre Google Web Direct (Panoramique)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGoogleSubTab('knowledge')}
                  className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                    googleSubTab === 'knowledge'
                      ? 'border-[#1877f2] text-[#1877f2] font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Compass size={15} />
                  <span>Fiches Pédagogiques &amp; Documentation</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGoogleSubTab('platform')}
                  className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                    googleSubTab === 'platform'
                      ? 'border-[#1877f2] text-[#1877f2] font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Folder size={15} />
                  <span>Cours E-Schola Associés ({matchingPlatformCourses.length})</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 pb-2 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Résultats intégrés sans redirection externe</span>
              </div>
            </div>

            {/* CONTENU DU SOUS-ONGLET SÉLECTIONNÉ */}
            <div className="p-4 sm:p-6 bg-slate-100/60">
              {/* 1. Cadre Live Google Iframe */}
              {googleSubTab === 'live' && (
                <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-white">
                  {isIframeLoading && (
                    <div className="absolute inset-0 bg-white/85 backdrop-blur-xs z-20 flex flex-col items-center justify-center space-y-3">
                      <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-extrabold text-slate-800">
                        Chargement des résultats Google en mode panoramique...
                      </p>
                      <p className="text-[11px] text-slate-500">Requête : « {activeGoogleQuery} »</p>
                    </div>
                  )}

                  <iframe
                    key={iframeKey}
                    src={`https://www.google.com/search?igu=1&q=${encodeURIComponent(activeGoogleQuery)}`}
                    title="Google Search Panoramique Intégré"
                    className={`w-full ${frameHeightClass} border-none transition-all`}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    onLoad={() => setIsIframeLoading(false)}
                  />
                </div>
              )}

              {/* 2. Fiches Pédagogiques & Documentation Découverte */}
              {googleSubTab === 'knowledge' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2 text-[#1877f2]">
                      <Sparkles size={18} />
                      <h3 className="text-sm font-black text-slate-900">
                        Synthèse Pédagogique Web pour « {activeGoogleQuery} »
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Résultats consolidés de recherche académique et technique. Ces ressources complémentaires enrichissent les modules de cours E-Schola Pro sans quitter votre espace de travail.
                    </p>
                  </div>

                  {/* Cartes de Savoirs Web */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 hover:border-blue-300 transition-all flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-[#1877f2] font-black text-[10px] uppercase">
                          Documentation
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">Officiel</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Guides &amp; Références Officielles
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed flex-grow">
                        Accédez aux spécifications officielles, architectures logicielles et standards industriels pour approfondir les compétences du cours.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleSubTab('live');
                          setActiveGoogleQuery(`${activeGoogleQuery} documentation officielle`);
                          setIsIframeLoading(true);
                          setIframeKey((k) => k + 1);
                        }}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1877f2] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Search size={13} />
                        <span>Explorer la documentation dans le cadre</span>
                      </button>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 hover:border-blue-300 transition-all flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase">
                          Tutoriels &amp; TP
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">Pratique</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Ateliers Pratiques &amp; Exemples de Code
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed flex-grow">
                        Exercices corrigés pas à pas, projets guidés et snippets de code prêts à tester pour valider vos connaissances techniques.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleSubTab('live');
                          setActiveGoogleQuery(`${activeGoogleQuery} tutoriel pratique et code`);
                          setIsIframeLoading(true);
                          setIframeKey((k) => k + 1);
                        }}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Search size={13} />
                        <span>Rechercher les TP pratiques</span>
                      </button>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 hover:border-blue-300 transition-all flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-black text-[10px] uppercase">
                          Vidéos &amp; Conférences
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">Multimédia</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Webinaires &amp; Retours d'Expérience
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed flex-grow">
                        Analyses expertes, keynotes et démonstrations vidéo pour saisir les cas d'usage réels en entreprise.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleSubTab('live');
                          setActiveGoogleQuery(`${activeGoogleQuery} video conference tutoriel`);
                          setIsIframeLoading(true);
                          setIframeKey((k) => k + 1);
                        }}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Search size={13} />
                        <span>Voir les vidéos dans le cadre</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Cours E-Schola Associés */}
              {googleSubTab === 'platform' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Continuité Pédagogique E-Schola Pro
                      </h4>
                      <p className="text-xs text-slate-700">
                        {matchingPlatformCourses.length > 0
                          ? `${matchingPlatformCourses.length} dossier(s) de formation trouvé(s) sur la plateforme en lien avec votre recherche.`
                          : "Aucun cours direct n'a été trouvé avec ce mot-clé, mais les résultats Google ci-dessus couvrent le sujet."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSearchEngine('app')}
                      className="px-4 py-2 rounded-xl bg-[#1877f2] text-white text-xs font-bold hover:bg-[#166fe5] transition-all cursor-pointer shrink-0 shadow-xs"
                    >
                      Basculer sur le catalogue complet
                    </button>
                  </div>

                  {matchingPlatformCourses.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {matchingPlatformCourses.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1877f2] text-[10px] font-black uppercase">
                              Dossier #{c.id}
                            </span>
                            <h4 className="text-sm font-extrabold text-slate-900">{c.title}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <span className="text-[11px] text-slate-600 font-semibold">
                              {c.videos?.length || 0} leçons vidéo
                            </span>
                            <Link
                              href={`/courses/${c.id}`}
                              className="px-3 py-1.5 rounded-xl bg-[#1877f2] text-white text-xs font-bold flex items-center gap-1 hover:bg-[#166fe5] transition-all"
                            >
                              <span>Ouvrir le cours</span>
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ======================================================================= */
        /* 4. CAS B : CATALOGUE INTERNE (VUE DOSSIERS OU VUE GRILLE PANORAMIQUE)  */
        /* ======================================================================= */
        <>
          {/* Barre de contrôle : Filtres de Catégories & Commutateur Dossiers/Grille */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pb-2 border-b border-slate-200">
            {/* Pilules de catégories */}
            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#1877f2] text-white shadow-xs shadow-blue-500/30 ring-1 ring-blue-400/30'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Commutateurs Dossiers / Grille */}
            <div className="flex items-center justify-center gap-3 shrink-0">
              {viewMode === 'folders' && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <button
                    onClick={expandAllFolders}
                    className="hover:text-[#1877f2] px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Tout ouvrir
                  </button>
                  <span>•</span>
                  <button
                    onClick={collapseAllFolders}
                    className="hover:text-[#1877f2] px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Tout fermer
                  </button>
                </div>
              )}

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('folders')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'folders' ? 'bg-white text-[#1877f2] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Vue Dossiers Pédagogiques"
                >
                  <FolderOpen size={15} />
                  <span>Vue Dossiers</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'grid' ? 'bg-white text-[#1877f2] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Vue Grille de Cartes"
                >
                  <LayoutGrid size={15} />
                  <span>Vue Grille</span>
                </button>
              </div>
            </div>
          </div>

          {/* Zone de contenu des cours */}
          {filteredCourses.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-4 max-w-xl mx-auto my-8">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#1877f2] flex items-center justify-center mx-auto">
                <FolderOpen size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Aucun cours trouvé</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {searchQuery
                  ? `Aucun dossier ni vidéo ne correspond au terme "${searchQuery}".`
                  : "Aucun cours n'est actuellement disponible dans cette catégorie."}
              </p>
              {searchQuery && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                  <button
                    onClick={() => {
                      setSearchEngine('google');
                      setActiveGoogleQuery(searchQuery);
                      setIsIframeLoading(true);
                    }}
                    className="px-4 py-2 bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Globe size={14} />
                    <span>Chercher sur Google Intégré</span>
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'folders' ? (
            /* 1. VUE DOSSIERS PÉDAGOGIQUES */
            <div className="space-y-6">
              {filteredCourses.map((course) => {
                const isFolderOpen = !!openFolders[course.id];
                const videoList = course.videos || [];
                const instructorLabel = course.instructor?.email
                  ? course.instructor.email.split('@')[0]
                  : `Formateur #${course.instructor_id}`;

                return (
                  <div
                    key={course.id}
                    className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:border-blue-300"
                  >
                    {/* En-tête du Dossier de Cours */}
                    <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-5">
                      <div className="flex items-start sm:items-center gap-4">
                        {/* Folder Icon / Cover Preview */}
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-blue-50 border border-blue-200/60 shadow-2xs">
                          {course.cover_image_url ? (
                            <Image
                              src={course.cover_image_url}
                              alt={course.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#1877f2]">
                              <Folder size={28} />
                            </div>
                          )}
                        </div>

                        {/* Folder Metadata */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1877f2] font-black text-[11px] uppercase tracking-wider">
                              Dossier #{course.id}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              Formateur : <strong className="text-slate-900">{instructorLabel}</strong>
                            </span>
                          </div>

                          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                            {course.title}
                          </h2>

                          <p className="text-xs text-slate-500 max-w-3xl line-clamp-2 leading-relaxed">
                            {course.description || 'Support et leçons vidéo associées à cette formation.'}
                          </p>
                        </div>
                      </div>

                      {/* Folder Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                        {course.document_url && (
                          <DownloadCourseButton
                            documentUrl={course.document_url}
                          />
                        )}

                        <Link
                          href={`/courses/${course.id}`}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <span>Fiche du cours</span>
                          <ArrowRight size={13} />
                        </Link>

                        <button
                          type="button"
                          onClick={() => toggleFolder(course.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isFolderOpen
                              ? 'bg-blue-50 text-[#1877f2] border border-blue-200'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Film size={14} />
                          <span>{videoList.length} {videoList.length > 1 ? 'Vidéos' : 'Vidéo'}</span>
                          {isFolderOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Contenu Dépliable du Dossier : Liste Panoramique des Vidéos */}
                    {isFolderOpen && (
                      <div className="p-5 sm:p-6 bg-slate-50/50">
                        {videoList.length === 0 ? (
                          <div className="py-8 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-2">
                            <Film size={28} className="mx-auto text-slate-300" />
                            <p className="text-xs font-bold text-slate-600">
                              Aucune vidéo n'a encore été ajoutée dans ce dossier.
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Utilisez le bouton « Ajouter une vidéo » ci-dessus pour téléverser votre première leçon.
                            </p>
                          </div>
                        ) : (
                          <div
                            className={`grid gap-4 ${
                              isPanoramic
                                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                                : 'grid-cols-1 md:grid-cols-2'
                            }`}
                          >
                            {videoList.map((video, idx) => (
                              <div
                                key={video.id || idx}
                                onClick={() =>
                                  setActiveModalVideo({
                                    video,
                                    course,
                                    videoIndex: idx,
                                  })
                                }
                                className="group relative bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-center gap-3.5 overflow-hidden"
                              >
                                <div className="relative w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden bg-slate-900 shrink-0 shadow-2xs flex items-center justify-center">
                                  <div className="absolute inset-0 bg-blue-900/30 group-hover:bg-blue-600/40 transition-colors" />
                                  <PlayCircle
                                    size={28}
                                    className="text-white relative z-10 group-hover:scale-115 transition-transform duration-200 drop-shadow"
                                  />
                                  <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/70 text-white text-[9px] font-mono font-bold z-10">
                                    HD
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-[#1877f2] transition-colors">
                                      #{idx + 1}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-400 truncate">
                                      Leçon de formation
                                    </span>
                                  </div>

                                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-[#1877f2] transition-colors truncate">
                                    {video.title}
                                  </h4>

                                  <p className="text-[11px] text-slate-500 truncate">
                                    {video.description || 'Visionner la vidéo du cours'}
                                  </p>
                                </div>

                                <div className="text-slate-300 group-hover:text-[#1877f2] group-hover:translate-x-0.5 transition-all shrink-0">
                                  <ArrowRight size={16} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* 2. VUE GRILLE DE CARTES (Adaptée en Mode Panoramique 4K / Large) */
            <div
              className={`grid gap-6 ${
                isPanoramic
                  ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {filteredCourses.map((course) => {
                const isFolderOpen = !!openFolders[course.id];
                const videoList = course.videos || [];
                const instructorLabel = course.instructor?.email
                  ? course.instructor.email.split('@')[0]
                  : `Formateur #${course.instructor_id}`;

                return (
                  <div
                    key={course.id}
                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="h-44 w-full relative overflow-hidden bg-slate-100">
                      {course.cover_image_url ? (
                        <Image
                          src={course.cover_image_url}
                          alt={course.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <BookOpen size={48} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                        <span className="px-2.5 py-1 text-[11px] font-extrabold bg-black/50 backdrop-blur-md rounded-lg text-white border border-white/20">
                          Dossier #{course.id}
                        </span>
                        <span className="px-2.5 py-1 text-[11px] font-extrabold bg-[#1877f2] text-white rounded-lg shadow-xs flex items-center gap-1">
                          <Film size={11} /> {videoList.length} vidéos
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-grow space-y-3">
                      <h3 className="text-base font-extrabold text-slate-900 group-hover:text-[#1877f2] transition-colors line-clamp-2">
                        {course.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {course.description || "Aucune description fournie pour ce cours."}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 font-medium">
                        <Users size={14} className="text-slate-400" />
                        <span>Formateur : <strong className="text-slate-800">{instructorLabel}</strong></span>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleFolder(course.id)}
                          className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-[#1877f2] transition-colors py-1 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Film size={13} className="text-[#1877f2]" />
                            <span>{videoList.length} leçons vidéo incluses</span>
                          </span>
                          {isFolderOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isFolderOpen && (
                          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {videoList.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-1">Aucune vidéo.</p>
                            ) : (
                              videoList.map((v, vIdx) => (
                                <button
                                  key={v.id || vIdx}
                                  type="button"
                                  onClick={() =>
                                    setActiveModalVideo({
                                      video: v,
                                      course,
                                      videoIndex: vIdx,
                                    })
                                  }
                                  className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#1877f2] text-xs flex items-center justify-between group/v transition-colors cursor-pointer"
                                >
                                  <span className="truncate font-semibold text-[11px]">
                                    #{vIdx + 1} {v.title}
                                  </span>
                                  <PlayCircle size={14} className="text-slate-400 group-hover/v:text-[#1877f2] shrink-0" />
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                        <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                          <Star size={14} fill="currentColor" /> 5.0
                        </div>

                        <Link
                          href={`/courses/${course.id}`}
                          className="px-3.5 py-1.5 bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                        >
                          <span>Voir cours</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ======================================================================= */}
      {/* 5. MODAL DE VISIONNAGE VIDÉO HD INTERACTIF (ADAPTÉ AU FORMAT LARGE)     */}
      {/* ======================================================================= */}
      {activeModalVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
          <div
            className={`relative w-full ${
              isPanoramic ? 'max-w-6xl xl:max-w-7xl' : 'max-w-4xl'
            } bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200`}
          >
            {/* Modal Header avec Thème E-Schola Blue */}
            <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-[#1877f2] to-[#0052cc] text-white flex items-center justify-between shrink-0 shadow-xs">
              <div className="space-y-0.5 max-w-2xl">
                <div className="flex items-center gap-2 text-xs text-blue-100 font-extrabold">
                  <Folder className="w-3.5 h-3.5" />
                  <span>Dossier : {activeModalVideo.course.title}</span>
                  <span>•</span>
                  <span>
                    Leçon #{activeModalVideo.videoIndex + 1} / {activeModalVideo.course.videos?.length || 1}
                  </span>
                </div>
                <h3 className="text-base font-extrabold truncate text-white">
                  {activeModalVideo.video.title}
                </h3>
              </div>

              <button
                onClick={() => setActiveModalVideo(null)}
                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Fermer la vidéo"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Player Box Panoramique */}
            <div className="p-4 sm:p-6 bg-slate-950 flex items-center justify-center overflow-hidden">
              <div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-black">
                <YoutubePlayer
                  src={activeModalVideo.video.video_url}
                  title={activeModalVideo.video.title}
                  autoPlay={true}
                />
              </div>
            </div>

            {/* Video Meta & Playlist Navigator */}
            <div className="p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 overflow-y-auto">
              <div className="space-y-1 max-w-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  À propos de cette leçon
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {activeModalVideo.video.description || "Aucune description disponible pour cette vidéo."}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {activeModalVideo.videoIndex > 0 && (
                  <button
                    onClick={() => {
                      const prevIdx = activeModalVideo.videoIndex - 1;
                      const prevVid = activeModalVideo.course.videos?.[prevIdx];
                      if (prevVid) {
                        setActiveModalVideo({
                          video: prevVid,
                          course: activeModalVideo.course,
                          videoIndex: prevIdx,
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    ← Précédente
                  </button>
                )}

                {activeModalVideo.course.videos &&
                  activeModalVideo.videoIndex < activeModalVideo.course.videos.length - 1 && (
                    <button
                      onClick={() => {
                        const nextIdx = activeModalVideo.videoIndex + 1;
                        const nextVid = activeModalVideo.course.videos?.[nextIdx];
                        if (nextVid) {
                          setActiveModalVideo({
                            video: nextVid,
                            course: activeModalVideo.course,
                            videoIndex: nextIdx,
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Suivante →
                    </button>
                  )}

                <Link
                  href={`/courses/${activeModalVideo.course.id}`}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  Page complète du cours
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
