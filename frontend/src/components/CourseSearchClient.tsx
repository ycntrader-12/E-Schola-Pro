'use client';

import { useState, useEffect, useMemo } from 'react';
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
  ArrowRight
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

export default function CourseSearchClient({ initialCourses }: CourseSearchClientProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchEngine, setSearchEngine] = useState<'app' | 'google'>('app');
  const [viewMode, setViewMode] = useState<'folders' | 'grid'>('folders');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Track open/collapsed state for each course folder
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});

  // Active modal video player
  const [activeModalVideo, setActiveModalVideo] = useState<{
    video: CourseVideo;
    course: Course;
    videoIndex: number;
  } | null>(null);

  // Client-side dynamic refresh to ensure real-time consistency with backend database
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await apiClient.get('/courses/');
        if (res.data && Array.isArray(res.data)) {
          setCourses(res.data);
          // Auto-expand all folders on initial load so user immediately sees courses and their videos
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

  // Toggle single folder
  const toggleFolder = (courseId: number) => {
    setOpenFolders((prev) => ({
      ...prev,
      [courseId]: !prev[courseId]
    }));
  };

  // Expand all or collapse all folders
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchEngine === 'google' && searchQuery.trim()) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
    }
  };

  // Categories helper
  const categories = useMemo(() => [
    { id: 'all', label: 'Tous les dossiers' },
    { id: 'web', label: 'Web & Fullstack', match: ['next.js', 'react', 'web', 'javascript', 'frontend'] },
    { id: 'backend', label: 'Python & APIs', match: ['fastapi', 'python', 'api', 'backend', 'rest'] },
    { id: 'ai', label: 'IA & Data Science', match: ['intelligence', 'machine learning', 'data', 'pandas', 'scikit'] },
    { id: 'security', label: 'Cybersécurité & Réseaux', match: ['sécurité', 'cyber', 'réseau', 'owasp', 'tls'] }
  ], []);

  // Filter courses by search and category
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (searchEngine === 'google') return true;

      // Category filter
      if (selectedCategory !== 'all') {
        const cat = categories.find((c) => c.id === selectedCategory);
        if (cat?.match) {
          const text = `${course.title} ${course.description}`.toLowerCase();
          const matchesCat = cat.match.some((keyword) => text.includes(keyword.toLowerCase()));
          if (!matchesCat) return false;
        }
      }

      // Search query filter: check course title, description, instructor, and also video titles!
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

  // Aggregate statistics
  const totalCourses = courses.length;
  const totalVideos = courses.reduce((acc, c) => acc + (c.videos?.length || 0), 0);

  return (
    <div className="min-h-screen px-4 py-20 max-w-7xl mx-auto space-y-8">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <BackButton className="mb-2" />
      </div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 text-[#1877f2] font-extrabold text-xs">
            <Folder className="w-3.5 h-3.5" />
            <span>Campus Numérique • Dossiers de Formation</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Dossiers de Cours & <span className="bg-gradient-to-r from-[#1877f2] to-[#0052cc] bg-clip-text text-transparent">Vidéos Pédagogiques</span>
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Consultez notre bibliothèque de formations organisée par dossiers thématiques. Chaque dossier regroupe le cours, ses leçons vidéo séquencées et ses supports de cours.
          </p>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <Folder className="w-4 h-4 text-[#1877f2]" />
              <strong>{totalCourses}</strong> {totalCourses > 1 ? 'Dossiers de cours' : 'Dossier de cours'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <Film className="w-4 h-4 text-emerald-600" />
              <strong>{totalVideos}</strong> {totalVideos > 1 ? 'Vidéos de formation' : 'Vidéo de formation'}
            </span>
          </div>
        </div>

        {/* Search Bar & Action Buttons */}
        <div className="flex flex-col gap-3 w-full lg:w-auto shrink-0">
          <form onSubmit={handleSearchSubmit} className="flex items-center w-full lg:w-96 shadow-xs rounded-2xl overflow-hidden border border-slate-200 bg-white">
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-3.5 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchEngine === 'app' ? "Rechercher cours, vidéo, compétence..." : "Rechercher sur Google..."}
                className="w-full pl-10 pr-3 py-2.5 bg-transparent text-slate-900 placeholder:text-slate-400 outline-none text-xs font-medium"
              />
            </div>
            <select
              value={searchEngine}
              onChange={(e) => setSearchEngine(e.target.value as 'app' | 'google')}
              className="bg-slate-50 border-l border-slate-200 px-3 py-2.5 text-xs text-slate-600 font-bold hover:text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="app">App</option>
              <option value="google">Google</option>
            </select>
          </form>

          {/* Action buttons (Upload Video & Create Course) */}
          <div className="flex flex-wrap items-center gap-2">
            <UploadVideoButton courses={courses} />
            <CreateCourseButton />
          </div>
        </div>
      </div>

      {/* Control Bar: Categories Filter & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#1877f2] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* View Mode Switcher & Folders Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {viewMode === 'folders' && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
              <button
                onClick={expandAllFolders}
                className="hover:text-[#1877f2] px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Tout ouvrir
              </button>
              <span>•</span>
              <button
                onClick={collapseAllFolders}
                className="hover:text-[#1877f2] px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Tout fermer
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('folders')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'folders'
                  ? 'bg-white text-[#1877f2] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vue Dossiers Pédagogiques"
            >
              <FolderOpen size={15} />
              <span>Vue Dossiers</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#1877f2] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vue Grille de Cartes"
            >
              <LayoutGrid size={15} />
              <span>Vue Grille</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
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
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : viewMode === 'folders' ? (
        /* ======================================================================= */
        /* 1. VUE DOSSIERS PÉDAGOGIQUES (Folder Explorer with collapsible videos)   */
        /* ======================================================================= */
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

                    {/* Folder Meta & Title */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-50 text-[#1877f2] border border-blue-200">
                          <Folder className="w-3 h-3" /> DOSSIER #{course.id}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Film className="w-3 h-3" /> {videoList.length} {videoList.length > 1 ? 'Vidéos' : 'Vidéo'}
                        </span>
                        {course.document_url && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <FileText className="w-3 h-3" /> Support PDF
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                        {course.title}
                      </h2>

                      <p className="text-xs text-slate-500 line-clamp-1 max-w-2xl">
                        {course.description || "Aucune description détaillée."}
                      </p>

                      <div className="flex items-center gap-3 pt-0.5 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Users size={13} className="text-slate-400" /> Formateur : <strong className="text-slate-800">{instructorLabel}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Folder Actions */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => toggleFolder(course.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isFolderOpen
                          ? 'bg-blue-50 text-[#1877f2] border-blue-200'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                      title={isFolderOpen ? "Fermer le dossier de vidéos" : "Ouvrir le dossier de vidéos"}
                    >
                      {isFolderOpen ? (
                        <>
                          <FolderOpen size={15} />
                          <span>Masquer vidéos</span>
                          <ChevronUp size={15} />
                        </>
                      ) : (
                        <>
                          <Folder size={15} />
                          <span>Ouvrir dossier ({videoList.length})</span>
                          <ChevronDown size={15} />
                        </>
                      )}
                    </button>

                    <Link
                      href={`/courses/${course.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      <span>Accéder au cours</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Contenu interne du Dossier : Vidéos et documents */}
                {isFolderOpen && (
                  <div className="p-5 sm:p-7 bg-slate-50/50 border-t border-slate-100 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-[#1877f2]" />
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Vidéos & Chapitres du dossier ({videoList.length})
                        </h3>
                      </div>
                      {course.document_url && (
                        <div className="shrink-0">
                          <DownloadCourseButton documentUrl={course.document_url} />
                        </div>
                      )}
                    </div>

                    {videoList.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                        Aucune vidéo n'a encore été ajoutée dans ce dossier de cours.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {videoList.map((video, vIdx) => (
                          <div
                            key={video.id}
                            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between group"
                          >
                            <div className="space-y-2">
                              {/* Video Tag & Order */}
                              <div className="flex items-center justify-between text-xs">
                                <span className="inline-flex items-center gap-1 font-extrabold text-[#1877f2] bg-blue-50 px-2 py-0.5 rounded-md text-[11px] border border-blue-100">
                                  <Film size={12} /> Leçon #{video.order_index || vIdx + 1}
                                </span>
                                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                                  <Clock size={12} /> Vidéo HD
                                </span>
                              </div>

                              {/* Video Title */}
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#1877f2] transition-colors line-clamp-2">
                                {video.title}
                              </h4>

                              {/* Video Description */}
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {video.description || "Visionnez cette leçon vidéo pour maîtriser les concepts abordés dans ce module."}
                              </p>
                            </div>

                            {/* Play Button inside card */}
                            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                              <button
                                onClick={() => setActiveModalVideo({ video, course, videoIndex: vIdx })}
                                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1877f2] hover:text-[#0052cc] transition-colors cursor-pointer"
                              >
                                <PlayCircle size={17} className="group-hover:scale-110 transition-transform" />
                                <span>Visionner la vidéo</span>
                              </button>

                              <Link
                                href={`/courses/${course.id}`}
                                className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                                title="Ouvrir dans la page cours"
                              >
                                <ExternalLink size={14} />
                              </Link>
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
        /* ======================================================================= */
        /* 2. VUE GRILLE DE CARTES (Card Grid with expandable video drawer)        */
        /* ======================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                {/* Course Cover Image */}
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
                  
                  {/* Category & Badge */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                    <span className="px-2.5 py-1 text-[11px] font-extrabold bg-black/50 backdrop-blur-md rounded-lg text-white border border-white/20">
                      Dossier #{course.id}
                    </span>
                    <span className="px-2.5 py-1 text-[11px] font-extrabold bg-[#1877f2] text-white rounded-lg shadow-xs flex items-center gap-1">
                      <Film size={11} /> {videoList.length} vidéos
                    </span>
                  </div>
                </div>

                {/* Card Content */}
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

                  {/* Toggle Folder Videos */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() => toggleFolder(course.id)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#1877f2] border border-slate-200 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Folder size={14} className="text-[#1877f2]" />
                        <span>Vidéos du dossier ({videoList.length})</span>
                      </span>
                      {isFolderOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {/* Inline videos drawer in grid card */}
                    {isFolderOpen && (
                      <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 pt-1">
                        {videoList.length === 0 ? (
                          <p className="text-[11px] text-slate-400 text-center py-2">Aucune vidéo.</p>
                        ) : (
                          videoList.map((v, idx) => (
                            <div
                              key={v.id}
                              onClick={() => setActiveModalVideo({ video: v, course, videoIndex: idx })}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-[#1877f2] cursor-pointer transition-colors text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <PlayCircle size={14} className="text-[#1877f2] shrink-0" />
                                <span className="font-semibold truncate">{idx + 1}. {v.title}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Links */}
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

      {/* ======================================================================= */}
      {/* 3. MODAL DE VISIONNAGE VIDÉO HD INTERACTIF                               */}
      {/* ======================================================================= */}
      {activeModalVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="space-y-0.5 max-w-2xl">
                <div className="flex items-center gap-2 text-xs text-blue-300 font-extrabold">
                  <Folder className="w-3.5 h-3.5" />
                  <span>Dossier : {activeModalVideo.course.title}</span>
                  <span>•</span>
                  <span>Leçon #{activeModalVideo.videoIndex + 1} / {activeModalVideo.course.videos?.length || 1}</span>
                </div>
                <h3 className="text-base font-extrabold truncate">
                  {activeModalVideo.video.title}
                </h3>
              </div>

              <button
                onClick={() => setActiveModalVideo(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Fermer la vidéo"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Player Box */}
            <div className="p-4 sm:p-6 bg-slate-950 flex items-center justify-center overflow-hidden">
              <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-black">
                <YoutubePlayer
                  src={activeModalVideo.video.video_url}
                  title={activeModalVideo.video.title}
                  autoPlay={true}
                />
              </div>
            </div>

            {/* Video Meta & Folder Playlist Navigator */}
            <div className="p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 overflow-y-auto">
              <div className="space-y-1 max-w-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  À propos de cette leçon
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {activeModalVideo.video.description || "Aucune description disponible pour cette vidéo."}
                </p>
              </div>

              {/* Navigation in Folder Playlist */}
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
                          videoIndex: prevIdx
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    ← Leçon précédente
                  </button>
                )}

                {activeModalVideo.course.videos && activeModalVideo.videoIndex < activeModalVideo.course.videos.length - 1 && (
                  <button
                    onClick={() => {
                      const nextIdx = activeModalVideo.videoIndex + 1;
                      const nextVid = activeModalVideo.course.videos?.[nextIdx];
                      if (nextVid) {
                        setActiveModalVideo({
                          video: nextVid,
                          course: activeModalVideo.course,
                          videoIndex: nextIdx
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Leçon suivante →
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
