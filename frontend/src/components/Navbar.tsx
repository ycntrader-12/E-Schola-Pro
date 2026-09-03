'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, User, GraduationCap, MessageSquare, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api';
import LanguageSwitcher from './LanguageSwitcher';
import BackButton from './BackButton';
import ForwardButton from './ForwardButton';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const tNav = useTranslations('Navigation');
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeClassroomsCount, setActiveClassroomsCount] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      setIsAuthenticated(!!token);
      if (token) {
        try {
          const [userRes, unreadRes, roomsRes] = await Promise.all([
            apiClient.get('/users/me'),
            apiClient.get('/messages/unread-count').catch(() => ({ data: { unread_count: 0 } })),
            apiClient.get('/classrooms/').catch(() => ({ data: [] }))
          ]);
          setUserRole(userRes.data.role);
          setUnreadCount(unreadRes.data?.unread_count || 0);
          const activeCount = Array.isArray(roomsRes.data)
            ? roomsRes.data.filter((r: any) => r.is_active).length
            : 0;
          setActiveClassroomsCount(activeCount);
        } catch {
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
    };
    checkAuth();
    
    // 10-second active polling for live notifications
    const pollInterval = setInterval(checkAuth, 10000);

    window.addEventListener('storage', checkAuth);
    window.addEventListener('auth_user_updated', checkAuth);
    window.addEventListener('messages_updated', checkAuth);
    window.addEventListener('classroom_updated', checkAuth);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('auth_user_updated', checkAuth);
      window.removeEventListener('messages_updated', checkAuth);
      window.removeEventListener('classroom_updated', checkAuth);
    };
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    setIsAuthenticated(false);
    setUserRole(null);
    window.dispatchEvent(new Event('storage'));
    router.push('/login');
  };

  // Hide navbar on dashboard (with or without locale prefix)
  const normalizedPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
  if (normalizedPath === '/dashboard' || normalizedPath.startsWith('/dashboard/')) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#e4e6eb] h-16 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {normalizedPath !== '/' && normalizedPath !== '' && (
            <div className="hidden sm:flex items-center gap-2">
              <BackButton label="" className="p-2 bg-slate-100 border border-slate-200 rounded-full hover:bg-slate-200" />
              <ForwardButton label="" className="p-2 bg-slate-100 border border-slate-200 rounded-full hover:bg-slate-200" />
            </div>
          )}
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#1877f2] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <GraduationCap size={18} />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#050505]">
              E-Schola <span className="text-[#1877f2] font-extrabold">Pro</span>
            </span>
          </Link>
        </div>

        {/* Right Section : Language Switcher & Auth */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {!isMounted ? (
            <div className="w-20 h-8 bg-slate-100 animate-pulse rounded-full" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Classroom Notification Link with Blinking Signal Light */}
              <Link 
                href="/classroom"
                className="p-2 rounded-xl text-[#65676b] hover:text-emerald-600 hover:bg-emerald-50/70 transition-all relative group"
                title={activeClassroomsCount > 0 ? `${activeClassroomsCount} session(s) de classe virtuelle active(s)` : "Classes Virtuelles & Sessions en direct"}
                aria-label="Classe Virtuelle"
              >
                <Video size={18} className={`transition-colors ${activeClassroomsCount > 0 ? 'text-emerald-600 animate-pulse' : 'group-hover:text-emerald-600'}`} />
                {activeClassroomsCount > 0 ? (
                  <>
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full animate-ping opacity-75" />
                    <span className="absolute top-1 right-1 min-w-3.5 h-3.5 px-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                      {activeClassroomsCount}
                    </span>
                  </>
                ) : (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-slate-300 rounded-full ring-2 ring-white" />
                )}
              </Link>

              {/* Message / Inbox Notification Link with Blinking Signal Light */}
              <Link 
                href="/inbox"
                className="p-2 rounded-xl text-[#65676b] hover:text-[#1877f2] hover:bg-blue-50/70 transition-all relative group"
                title={unreadCount > 0 ? `${unreadCount} message(s) non lu(s)` : "Messagerie & Boîte de réception"}
                aria-label="Boîte de réception"
              >
                <MessageSquare size={18} className={`transition-colors ${unreadCount > 0 ? 'text-[#1877f2] animate-bounce' : 'group-hover:text-[#1877f2]'}`} />
                {unreadCount > 0 ? (
                  <>
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-blue-500 rounded-full animate-ping opacity-75" />
                    <span className="absolute top-1 right-1 min-w-3.5 h-3.5 px-0.5 bg-[#1877f2] text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                      {unreadCount}
                    </span>
                  </>
                ) : (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-slate-300 rounded-full ring-2 ring-white" />
                )}
              </Link>

              <Link 
                href="/profile"
                className="flex items-center gap-2 text-sm font-medium text-[#65676b] hover:text-[#050505] transition-colors"
                title={tNav('profile')}
              >
                <User size={18} />
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-[#65676b] hover:text-red-500 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">{tNav('logout')}</span>
              </button>
            </div>
          ) : (
            <>
              <Link 
                href="/login"
                className="hidden sm:block text-sm font-bold text-[#65676b] hover:text-[#050505] transition-colors px-2 py-1"
              >
                {tNav('sign_in')}
              </Link>
              <Link 
                href="/register"
                className="px-4 py-2 bg-[#1877f2] text-white rounded-xl text-sm font-bold hover:bg-[#166fe5] transition-colors shadow-xs"
              >
                {tNav('sign_up')}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
