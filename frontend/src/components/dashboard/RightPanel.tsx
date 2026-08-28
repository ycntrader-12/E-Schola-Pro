'use client';

import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { Bell, MessageSquare, Mail, Plus } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import LanguageSwitcher from '../LanguageSwitcher';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function RightPanel() {
  const [user, setUser] = useState<{ email?: string; avatar_url?: string } | null>(null);
  const [mentors, setMentors] = useState<{id: number, email: string}[]>([]);
  const router = useRouter();
  const t = useTranslations('Dashboard');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, coursesRes] = await Promise.all([
          apiClient.get('/users/me'),
          apiClient.get('/courses/')
        ]);
        
        setUser(userRes.data);
        
        // Extract unique mentors from courses
        const courses = coursesRes.data;
        const uniqueMentorsMap = new Map();
        
        courses.forEach((course: any) => {
          if (course.instructor) {
            uniqueMentorsMap.set(course.instructor_id, course.instructor);
          }
        });
        
        setMentors(Array.from(uniqueMentorsMap.values()).slice(0, 3));
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.dispatchEvent(new Event('storage'));
    router.push('/login');
  };

  const name = user?.email ? user.email.split('@')[0] : 'User';
  const avatar = user?.avatar_url || `https://ui-avatars.com/api/?name=${name}&background=8b5cf6&color=fff`;

  return (
    <aside className="w-80 h-screen fixed right-0 top-0 border-l border-border bg-background p-6 flex flex-col z-40 overflow-y-auto">
      
      {/* Top Icons */}
      <div className="flex items-center justify-end gap-3 mb-8">
        <LanguageSwitcher />
        <ThemeToggle />
        <button onClick={handleLogout} className="text-xs font-bold text-text-secondary hover:text-red-400">LOGOUT</button>
      </div>

      {/* Profile summary */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative w-24 h-24 rounded-full p-1 border-2 border-primary border-dashed mb-4 flex items-center justify-center">
          {user?.avatar_url ? (
            <Image src={user.avatar_url} alt="Profile" fill className="rounded-full object-cover p-1" unoptimized />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-2xl font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold text-center">{t('good_morning')} {name}</h2>
        <p className="text-sm text-text-secondary text-center mt-2">{t('continue_journey')}</p>
        
        <div className="flex gap-4 mt-6">
          <Link href="/calendar" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-secondary hover:bg-surface hover:text-primary transition-colors" title="Notifications & Calendrier">
            <Bell size={18} />
          </Link>
          <Link href="/classroom" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-secondary hover:bg-surface hover:text-primary transition-colors" title="Classe Virtuelle">
            <MessageSquare size={18} />
          </Link>
          <Link href="/inbox" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-secondary hover:bg-surface hover:text-primary transition-colors" title="Messagerie & Courrier">
            <Mail size={18} />
          </Link>
        </div>
      </div>

      {/* Removed Chart Placeholder as requested */}

      {/* Your Mentor */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{t('your_mentor')}</h3>
          <button className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-text-secondary hover:bg-surface hover:text-primary">
            <Plus size={14} />
          </button>
        </div>
        
        <div className="space-y-4">
          {mentors.length > 0 ? (
            mentors.map((mentor, idx) => {
              const mentorName = mentor.email ? mentor.email.split('@')[0] : `Mentor #${mentor.id}`;
              return (
                <div key={mentor.id || idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Image src={`https://ui-avatars.com/api/?name=${mentorName}&background=06b6d4&color=fff`} alt={mentorName} width={32} height={32} className="rounded-full" />
                    <div>
                      <p className="text-sm font-bold truncate max-w-[100px]">{mentorName}</p>
                      <p className="text-[10px] text-text-secondary">Instructor</p>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-[10px] font-bold bg-primary text-white rounded-full hover:bg-primary/90">
                    {t('follow')}
                  </button>
                </div>
              );
            })
          ) : (
             <p className="text-xs text-text-secondary text-center py-4">No mentors available yet</p>
          )}
        </div>
      </div>

    </aside>
  );
}

