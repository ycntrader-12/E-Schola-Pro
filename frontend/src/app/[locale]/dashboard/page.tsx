'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Menu, 
  User, 
  Search, 
  Bell, 
  ChevronDown, 
  BookOpen,
  GraduationCap,
  Globe,
  ExternalLink,
  X,
  LogOut
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import RightPanel from '@/components/dashboard/RightPanel';
import AttendancePerformanceWidget from '@/components/dashboard/AttendancePerformanceWidget';
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
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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
        // Fetch current user, all courses & unread messages
        const [userRes, coursesRes, unreadRes] = await Promise.all([
          apiClient.get('/users/me'),
          apiClient.get('/courses/'),
          apiClient.get('/messages/unread-count').catch(() => ({ data: { unread_count: 0 } }))
        ]);
        setCurrentUser(userRes.data);
        setAllCourses(coursesRes.data);
        setUnreadCount(unreadRes.data?.unread_count || 0);
      } catch (err) {
        console.error(err);
        localStorage.removeItem('access_token');
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
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
    const q = (queryToSearch || searchQuery).trim();
    if (q) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
      setIsSearchDropdownOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (matchingCourses.length > 0) {
        router.push(`/courses/${matchingCourses[0].id}`);
        setIsSearchDropdownOpen(false);
      } else if (searchQuery.trim()) {
        handleGoogleSearch();
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
        <span className="font-extrabold text-sm tracking-tight flex items-center gap-1">
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
            <div className="w-8 h-8 rounded-xl bg-[#1877f2] flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <GraduationCap size={18} />
            </div>
            <div>
              <p className="text-xs font-black leading-tight text-slate-900">
                E-Schola <span className="text-[#1877f2]">Pro</span>
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">E-Learning Professionnel</p>
            </div>
          </div>

          {/* Search Bar with Live Local Filter & Google Search Integration */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-lg w-full">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 text-slate-400 pointer-events-none" size={16} />
              <input 
                type="text" 
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher un cours ou sur Google..." 
                className="w-full pl-9 pr-20 py-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none shadow-xs focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 transition-all"
              />
              
              {/* Clear search or Google Search button */}
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(''); setIsSearchDropdownOpen(false); }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                    title="Effacer"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleGoogleSearch()}
                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-[#1877f2] rounded-lg text-[11px] font-bold flex items-center gap-1 border border-blue-200 transition-all shadow-xs"
                  title="Rechercher sur Google"
                >
                  <Globe size={13} />
                  <span className="hidden md:inline">Google</span>
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

                {/* Direct Google Search Action */}
                <div className="p-2 bg-slate-50/60">
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

          {/* Right Header Controls : Notification Bell (linked to Inbox) + Real Profile Capsule */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Notification Bell Connected to Messages / Inbox */}
            <button 
              onClick={() => router.push('/inbox')} 
              className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative cursor-pointer"
              title="Boîte de Réception & Messages"
            >
              <Bell size={20} className="text-slate-700" />
              {unreadCount > 0 ? (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-[#1877f2] text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              ) : (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#1877f2] rounded-full ring-2 ring-white" />
              )}
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
    </div>
  );
}
