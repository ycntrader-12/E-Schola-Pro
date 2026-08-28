'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { LayoutDashboard, Inbox, BookOpen, CheckSquare, Users, Settings, Video, Award, UserCheck, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api';

export default function Sidebar() {
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
    { name: 'Calendrier', href: '/calendar', icon: Calendar },
    { name: t('virtual_classroom'), href: '/classroom', icon: Video },
    { name: t('inbox'), href: '/inbox', icon: Inbox },
    { name: t('lesson'), href: '/courses', icon: BookOpen },
    { name: 'Quiz & Tests', href: '/quizzes', icon: Award },
    { name: 'Présences & Émargement', href: '/attendance', icon: UserCheck },
    { name: t('task'), href: '/tasks', icon: CheckSquare },
    { name: t('group'), href: '/group', icon: Users },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 border-r border-border bg-background pt-8 pb-8 flex flex-col z-40">
      <div className="px-8 mb-10">
        <span className="text-xl font-bold tracking-tight">
          E-Schola <span className="text-primary">Pro</span>
        </span>
      </div>

      <div className="px-4 mb-2 text-xs font-bold text-text-secondary tracking-wider shrink-0">
        {t('overview')}
      </div>
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-thin pb-4">
        {navItems.map((item) => {
          // Remove locale prefix from pathname to check active state
          const normalizedPathname = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
          const isActive = normalizedPathname === item.href || normalizedPathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-4">
                <Icon size={20} className={isActive ? 'text-primary' : 'text-text-secondary'} />
                {item.name}
              </div>
              {item.href === '/inbox' && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 mb-2 mt-4 text-xs font-bold text-text-secondary tracking-wider shrink-0 border-t border-border/50 pt-4">
        {t('settings')}
      </div>
      <div className="px-4 shrink-0">
        <Link
          href="/profile"
          className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-medium text-text-secondary hover:bg-surface hover:text-text-primary"
        >
          <Settings size={20} />
          {t('settings').charAt(0) + t('settings').slice(1).toLowerCase()}
        </Link>
      </div>
    </aside>
  );
}
