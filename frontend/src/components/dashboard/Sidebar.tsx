'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { LayoutDashboard, Inbox, BookOpen, CheckSquare, Users, Settings, Video, Award, UserCheck, Calendar, X, GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const res = await apiClient.get('/messages/unread-count');
          setUnreadCount(res.data.unread_count || 0);
        }
      } catch {}
    };
    fetchUnread();
  }, [pathname]);

  const navItems = [
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('calendar'), href: '/calendar', icon: Calendar },
    { name: t('virtual_classroom'), href: '/classroom', icon: Video },
    { name: t('inbox'), href: '/inbox', icon: Inbox },
    { name: t('lesson'), href: '/courses', icon: BookOpen },
    { name: t('quizzes'), href: '/quizzes', icon: Award },
    { name: t('task'), href: '/assignments', icon: CheckSquare },
    { name: t('attendance'), href: '/attendance', icon: UserCheck },
    { name: t('users'), href: '/admin/users', icon: Users, adminOnly: true },
  ];

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && setIsOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Signature Corporate Blue Sidebar Column */}
      <aside className={`w-64 h-screen fixed left-0 top-0 bg-[#16325c] border-r border-[#1e3a66] text-white flex flex-col py-6 z-50 transition-transform duration-300 shadow-xl lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 mb-8">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2563eb] to-[#38bdf8] flex items-center justify-center text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <GraduationCap size={22} />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1">
                E-Schola <span className="text-[#38bdf8]">Pro</span>
              </span>
              <p className="text-[9.5px] text-blue-200/70 font-medium tracking-wide">E-Learning Professionnel</p>
            </div>
          </Link>
          
          {setIsOpen && (
            <button 
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
              title="Fermer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="px-6 mb-2 text-[11px] font-bold text-blue-200/70 uppercase tracking-wider">
          {t('overview')}
        </div>
        
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Exact matching or parent matching
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen && setIsOpen(false)}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-[#2563eb] text-white font-bold shadow-md shadow-blue-600/30'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon 
                    size={19} 
                    className={`transition-colors ${
                      isActive ? 'text-white' : 'text-blue-200/80 group-hover:text-white'
                    }`} 
                  />
                  <span>{item.name}</span>
                </div>
                
                {/* Inbox unread badge */}
                {item.href === '/inbox' && unreadCount > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-white text-[#2563eb]' : 'bg-[#3b82f6] text-white'}`}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Settings Footer */}
        <div className="px-6 mb-2 mt-4 text-[11px] font-bold text-blue-200/70 uppercase tracking-wider shrink-0 border-t border-white/10 pt-4">
          {t('settings')}
        </div>
        <div className="px-3 shrink-0">
          <Link
            href="/profile"
            className="w-full group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white"
          >
            <Settings size={19} className="text-blue-200/80 group-hover:text-white transition-colors" />
            <span>{t('settings').charAt(0) + t('settings').slice(1).toLowerCase()}</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
