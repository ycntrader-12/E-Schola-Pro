'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Link, useRouter } from '@/i18n/routing';
import { 
  Menu, 
  User, 
  Search, 
  Bell,
  MessageSquare,
  Video, 
  ChevronDown, 
  BookOpen,
  GraduationCap,
  Globe,
  ExternalLink,
  X,
  LogOut,
  Sparkles
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import RightPanel from '@/components/dashboard/RightPanel';
import AttendancePerformanceWidget from '@/components/dashboard/AttendancePerformanceWidget';
import { GoogleAiAssistModal } from '@/components/inbox/GoogleAiAssistModal';
import { useTranslations } from 'next-intl';

interface Course {
  id: number;
  title: string;
  description: string;
  instructor_id: number;
  cover_image_url: string;
  document_url: string;
  created_at?: string;
  instructor?: { id: number; email: string; role: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string; avatar_url?: string } | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'internal' | 'google' | 'ai'>('all');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeClassroomsCount, setActiveClassroomsCount] = useState(0);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        // Fetch current user, all courses, unread messages, active classrooms & pending invitations
        const [userRes, coursesRes, unreadRes, classroomsRes, invitesRes] = await Promise.all([
          apiClient.get('/users/me'),
          apiClient.get('/courses/'),
          apiClient.get('/messages/unread-count').catch(() => ({ data: { unread_count: 0 } })),
          apiClient.get('/classrooms/').catch(() => ({ data: [] })),
          apiClient.get('/classrooms/invitations/my-invitations').catch(() => ({ data: [] }))
        ]);
        setCurrentUser(userRes.data);
        setAllCourses(coursesRes.data);
        setUnreadCount(unreadRes.data?.unread_count || 0);
        const activeRooms = Array.isArray(classroomsRes.data)
          ? classroomsRes.data.filter((r: any) => r.is_active).length
          : 0;
        setActiveClassroomsCount(activeRooms);
        const pendingCount = Array.isArray(invitesRes.data)
          ? invitesRes.data.filter((i: any) => i.status === 'pending').length
          : 0;
        setPendingInvitationsCount(pendingCount);
      } catch (err) {
        console.error(err);
        localStorage.removeItem('access_token');
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    const pollNotifications = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      try {
        const [unreadRes, classroomsRes, invitesRes] = await Promise.all([
          apiClient.get('/messages/unread-count').catch(() => ({ data: { unread_count: 0 } })),
          apiClient.get('/classrooms/').catch(() => ({ data: [] })),
          apiClient.get('/classrooms/invitations/my-invitations').catch(() => ({ data: [] }))
        ]);
        setUnreadCount(unreadRes.data?.unread_count || 0);
        const activeRooms = Array.isArray(classroomsRes.data)
          ? classroomsRes.data.filter((r: any) => r.is_active).length
          : 0;
        setActiveClassroomsCount(activeRooms);
        const pendingCount = Array.isArray(invitesRes.data)
          ? invitesRes.data.filter((i: any) => i.status === 'pending').length
          : 0;
        setPendingInvitationsCount(pendingCount);
      } catch {
        // Silent catch for background polling
      }
    };

    fetchData();

    // 10-second active polling for live notifications
    const pollInterval = setInterval(pollNotifications, 10000);

    // Event listeners for instant client-side updates
    window.addEventListener('messages_updated', pollNotifications);
    window.addEventListener('classroom_updated', pollNotifications);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('messages_updated', pollNotifications);
      window.removeEventListener('classroom_updated', pollNotifications);
    };
  }, [router]);

  // Click outside to close search and user dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('auth_user_updated'));
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const rawName = currentUser?.email ? currentUser.email.split('@')[0] : 'Apprenant';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // Filtered courses based on query
  const matchingCourses = searchQuery.trim()
    ? allCourses.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handleGoogleSearch = (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (q) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer');
      setIsSearchDropdownOpen(false);
    }
  };

  const handleOpenAiAssistant = (queryToPass?: string) => {
    const q = (queryToPass !== undefined ? queryToPass : searchQuery).trim();
    setAiPrompt(q);
    setIsAiModalOpen(true);
    setIsSearchDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchMode === 'ai') {
        handleOpenAiAssistant();
        return;
      }
      if (searchMode === 'google') {
        handleGoogleSearch();
        return;
      }
      if (matchingCourses.length > 0) {
        router.push(`/courses/${matchingCourses[0].id}`);
        setIsSearchDropdownOpen(false);
      } else if (searchQuery.trim()) {
        handleOpenAiAssistant();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row text-text-primary">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      {/* Mobile Header Bar */}
      <header className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-border bg-surface/90 backdrop-blur-md sticky top-0 z-30 w-full">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-xl bg-surface border border-border text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          title="Menu"
        >
          <Menu size={18} />
        </button>
        <span className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
          <Image src="/images/logo_icon_transparent.png" alt="E-Schola Pro" width={22} height={22} className="w-5.5 h-5.5 rounded-md object-contain" />
          E-Schola <span className="text-primary font-black">Pro</span>
        </span>
        <button 
          onClick={() => setIsRightPanelOpen(true)}
          className="p-2 rounded-xl bg-surface border border-border text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          title="Profil"
        >
          <User size={18} />
        </button>
      </header>
      
      {/* Main Content Area (Full Center Expansion) */}
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 md:p-8 transition-all min-w-0 max-w-7xl mx-auto w-full">
        
        {/* Top Navigation & Profile Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          
          {/* E-Schola Pro Brand Logo Header */}
          <div className="hidden sm:flex items-center gap-2.5 shrink-0">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-xs">
              <Image
                src="/images/logo_icon_transparent.png"
                alt="E-Schola Pro"
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-black leading-tight text-slate-900">
                E-Schola <span className="text-[#1877f2]">Pro</span>
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">E-Learning Professionnel</p>
            </div>
          </div>

          {/* Search Bar with Live Local Filter, Google Search & AI Mode Integration */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-xl w-full">
            <div className="relative flex items-center">
              {searchMode === 'ai' ? (
                <Sparkles className="absolute left-3.5 text-purple-500 animate-pulse pointer-events-none" size={16} />
              ) : searchMode === 'google' ? (
                <Globe className="absolute left-3.5 text-blue-500 pointer-events-none" size={16} />
              ) : (
                <Search className="absolute left-3.5 text-slate-400 pointer-events-none" size={16} />
              )}
              <input 
                type="text" 
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchMode === 'ai'
                    ? "Demander à l'assistant IA Google Gemini..."
                    : searchMode === 'google'
                    ? "Rechercher sur Google Web..."
                    : "Rechercher un cours, sur Google ou Mode IA..."
                } 
                className={`w-full pl-9 pr-36 sm:pr-44 py-2.5 rounded-xl bg-white border text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none shadow-xs transition-all ${
                  searchMode === 'ai'
                    ? 'border-purple-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100'
                    : searchMode === 'google'
                    ? 'border-blue-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                    : 'border-slate-200 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100'
                }`}
              />
              
              {/* Clear search, Google Search and Mode IA buttons */}
              <div className="absolute right-1.5 flex items-center gap-1">
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(''); setIsSearchDropdownOpen(false); }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                    title="Effacer"
                  >
                    <X size={14} />
                  </button>
                )}
                
                {/* Google Web Search Action Button */}
                <button
                  onClick={() => handleGoogleSearch()}
                  type="button"
                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-[#1877f2] rounded-lg text-[11px] font-bold flex items-center gap-1 border border-blue-200 transition-all shadow-xs cursor-pointer"
                  title="Rechercher sur Google"
                >
                  <Globe size={13} />
                  <span className="hidden sm:inline">Google</span>
                </button>

                {/* Mode IA Action Button */}
                <button
                  onClick={() => handleOpenAiAssistant()}
                  type="button"
                  className="px-2 sm:px-2.5 py-1 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 rounded-lg text-[11px] font-black flex items-center gap-1 border border-purple-200 hover:border-purple-300 transition-all shadow-xs cursor-pointer group"
                  title="Ouvrir le Mode IA Google Gemini"
                >
                  <Sparkles size={13} className="text-purple-600 group-hover:rotate-12 transition-transform" />
                  <span>Mode IA</span>
                </button>
              </div>
            </div>

            {/* Interactive Search Dropdown */}
            {isSearchDropdownOpen && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden text-xs animate-fade-in divide-y divide-slate-100">
                {/* Course Matches Section */}
                <div className="p-2">
                  <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Cours &amp; Formations ({matchingCourses.length})
                  </div>
                  {matchingCourses.length > 0 ? (
                    <div className="space-y-1">
                      {matchingCourses.slice(0, 4).map(course => (
                        <Link
                          key={course.id}
                          href={`/courses/${course.id}`}
                          onClick={() => setIsSearchDropdownOpen(false)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/70 transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#1877f2] flex items-center justify-center shrink-0">
                              <BookOpen size={14} />
                            </div>
                            <div className="truncate">
                              <p className="font-bold text-slate-900 group-hover:text-[#1877f2] transition-colors truncate">
                                {course.title}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {course.description || 'Support & Modules pédagogiques'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#1877f2] px-2 py-0.5 rounded bg-blue-50 border border-blue-200 shrink-0 ml-2">
                            Voir
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-slate-400 text-center text-xs">
                      Aucun cours trouvé pour « {searchQuery} »
                    </p>
                  )}
                </div>

                {/* Direct Google AI Gemini Assistant Action */}
                <div className="p-2 bg-gradient-to-r from-purple-50/70 to-indigo-50/70">
                  <button
                    onClick={() => handleOpenAiAssistant()}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-purple-700 font-bold hover:bg-purple-100/70 transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs">
                        <Sparkles size={14} className="animate-pulse" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-purple-900 group-hover:text-purple-700 truncate">
                          Demander à l'IA Gemini : <strong>« {searchQuery} »</strong>
                        </p>
                        <p className="text-[10px] text-purple-600 truncate font-normal">
                          Explications de cours, synthèse, aide aux devoirs et concepts clés
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-purple-700 px-2 py-0.5 rounded bg-purple-200/60 border border-purple-300 shrink-0 ml-2 shadow-2xs">
                      Mode IA
                    </span>
                  </button>
                </div>

                {/* Direct Google Search Action */}
                <div className="p-2 bg-slate-50/70">
                  <button
                    onClick={() => handleGoogleSearch()}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-[#1877f2] font-bold hover:bg-blue-100/60 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-[#1877f2]" />
                      <span>Rechercher <strong>« {searchQuery} »</strong> sur Google</span>
                    </div>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Header Controls : Classroom Live Icon + Message/Inbox Icon + Real Profile Capsule */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* 1. Classroom / Video Conference Live Icon with Blinking Signal Light */}
            <button 
              onClick={() => router.push('/classroom')} 
              className={`p-2 sm:p-2.5 rounded-xl transition-all relative cursor-pointer group ${
                pendingInvitationsCount > 0 
                  ? 'text-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500/30' 
                  : activeClassroomsCount > 0 
                    ? 'text-emerald-600 hover:bg-emerald-50/70' 
                    : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/70'
              }`}
              title={
                pendingInvitationsCount > 0
                  ? `${pendingInvitationsCount} nouvelle(s) invitation(s) en attente • Salles vidéo conférence`
                  : activeClassroomsCount > 0 
                    ? `${activeClassroomsCount} session(s) active(s) • Salles vidéo conférence` 
                    : "Salles vidéo conférence & Sessions en direct"
              }
              aria-label="Salle vidéo conférence"
            >
              <Video size={20} className={`transition-colors ${pendingInvitationsCount > 0 || activeClassroomsCount > 0 ? 'text-emerald-600 animate-pulse' : 'text-slate-700 group-hover:text-emerald-600'}`} />
              {pendingInvitationsCount > 0 ? (
                <>
                  {/* Outer Blinking Signal Halo */}
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full animate-ping opacity-80" />
                  {/* Badge Counter */}
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-emerald-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                    {pendingInvitationsCount}
                  </span>
                </>
              ) : activeClassroomsCount > 0 ? (
                <>
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full animate-ping opacity-75" />
                  <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-emerald-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                    {activeClassroomsCount}
                  </span>
                </>
              ) : null}
            </button>

            {/* 2. Messages / Inbox Icon with Blinking Signal Light */}
            <button 
              onClick={() => router.push('/inbox')} 
              className={`p-2 sm:p-2.5 rounded-xl transition-all relative cursor-pointer group ${
                unreadCount > 0 
                  ? 'text-[#1877f2] bg-blue-50/80 shadow-xs ring-1 ring-blue-500/30' 
                  : 'text-slate-600 hover:text-[#1877f2] hover:bg-blue-50/70'
              }`}
              title={unreadCount > 0 ? `${unreadCount} message(s) non lu(s)` : "Messagerie & Boîte de Réception"}
              aria-label="Boîte de réception"
            >
              <MessageSquare size={20} className={`transition-colors ${unreadCount > 0 ? 'text-[#1877f2] animate-bounce' : 'text-slate-700 group-hover:text-[#1877f2]'}`} />
              {unreadCount > 0 ? (
                <>
                  {/* Outer Blinking Signal Halo */}
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full animate-ping opacity-80" />
                  {/* Badge Counter */}
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[#1877f2] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                    {unreadCount}
                  </span>
                </>
              ) : null}
            </button>

            {/* Real Profile Capsule & Logout Menu */}
            <div ref={userMenuRef} className="relative">
              <div className="flex items-center gap-3 py-1.5 px-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                {/* Circular Avatar Photo or Real Initials */}
                <Link 
                  href="/profile"
                  className="w-10 h-10 rounded-full overflow-hidden relative shadow-xs border border-slate-200 shrink-0 flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer group"
                  title="Accéder à mon profil"
                >
                  {currentUser?.avatar_url ? (
                    <Image 
                      src={currentUser.avatar_url} 
                      alt={displayName} 
                      fill 
                      className="object-cover" 
                      unoptimized 
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#1877f2] to-[#38bdf8] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
                      {displayName.charAt(0)}
                    </div>
                  )}
                </Link>

                {/* Real User Name & Mon Compte & Se Déconnecter Button */}
                <div className="text-left flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href="/profile"
                      className="text-sm font-bold text-slate-900 hover:text-[#1877f2] transition-colors leading-tight"
                    >
                      {displayName}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
                      title="Menu du compte"
                    >
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180 text-[#1877f2]' : ''}`} />
                    </button>
                  </div>
                  
                  <Link
                    href="/profile"
                    className="text-xs text-slate-500 hover:text-[#1877f2] font-medium leading-tight mt-0.5 transition-colors"
                  >
                    Mon Compte
                  </Link>

                  {/* Bouton Se Déconnecter sous Mon Compte */}
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700 transition-colors mt-1 cursor-pointer w-fit group/btn"
                    title="Se déconnecter de votre session"
                  >
                    <LogOut size={11} className="group-hover/btn:-translate-x-0.5 transition-transform" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>

              {/* Dropdown Menu Déroulant sous le logo */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2 animate-fade-in divide-y divide-slate-100">
                  <div className="px-3 py-2">
                    <p className="text-xs font-bold text-slate-900">{displayName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#1877f2] border border-blue-200">
                      {currentUser?.role || 'Apprenant'}
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setIsUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#1877f2] transition-colors"
                    >
                      <User size={14} />
                      <span>Mon Compte &amp; Profil</span>
                    </Link>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                    >
                      <LogOut size={14} />
                      <span>Se déconnecter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1. Suivi d'Assiduité & Performances Académiques */}
        <AttendancePerformanceWidget />

        {/* 2. Votre Mentor (Courses & Instructors Table) */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">{t('your_mentor')}</h2>
            <Link href="/courses" className="text-[#1877f2] text-xs font-bold hover:underline">
              {t('see_all')}
            </Link>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">NOM DE L'INSTRUCTEUR & DATE</th>
                  <th className="px-6 py-3.5">TYPE DE COURS</th>
                  <th className="px-6 py-3.5">TITRE DU COURS</th>
                  <th className="px-6 py-3.5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allCourses.length > 0 ? allCourses.slice(0, 5).map(course => {
                  const instructorName = course.instructor?.email 
                    ? course.instructor.email.split('@')[0]
                    : `Formateur #${course.instructor_id}`;
                  return (
                    <tr key={course.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5 flex items-center gap-3">
                        <Image 
                          src={`https://ui-avatars.com/api/?name=${instructorName}&background=1877f2&color=fff`} 
                          alt="Mentor" 
                          width={32} 
                          height={32} 
                          className="rounded-full" 
                        />
                        <div>
                          <p className="font-bold text-xs text-slate-900">{instructorName}</p>
                          <p className="text-[10px] text-slate-500">Instructor</p>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-[#1877f2] rounded-md uppercase tracking-wider">
                          COURSE
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-xs text-slate-900">
                        {course.title}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Link 
                          href={`/courses/${course.id}`} 
                          className="px-4 py-2 text-xs font-bold text-white bg-[#1877f2] hover:bg-[#166fe5] rounded-xl transition-all shadow-xs inline-block"
                        >
                          {t('show_details')}
                        </Link>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs">
                      No courses available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Mobile Slide-Over Drawer Only */}
      {isRightPanelOpen && (
        <RightPanel isOpen={isRightPanelOpen} setIsOpen={setIsRightPanelOpen} />
      )}

      {/* Google AI Gemini Assistant Modal */}
      <GoogleAiAssistModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialPrompt={aiPrompt}
        defaultMode="ask"
      />
    </div>
  );
}
