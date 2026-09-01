'use client';

import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { Bell, MessageSquare, Mail, Plus, X } from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface RightPanelProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

export default function RightPanel({ isOpen, setIsOpen }: RightPanelProps) {
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
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <>
      {/* Mobile RightPanel Overlay */}
      {isOpen && setIsOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 xl:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slim Compact Right Panel (w-64) */}
      <aside className={`w-64 h-screen fixed right-0 top-0 border-l border-slate-200/80 bg-white text-slate-900 p-4 flex flex-col z-40 overflow-y-auto transition-transform duration-300 shadow-sm xl:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Top Controls: Compact switcher & Logout */}
        <div className="flex items-center justify-between mb-5 gap-1.5 pb-3 border-b border-slate-100">
          {setIsOpen && (
            <button 
              onClick={() => setIsOpen(false)}
              className="xl:hidden p-1 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Fermer"
            >
              <X size={15} />
            </button>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <LanguageSwitcher />
            <button 
              onClick={handleLogout} 
              className="text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
            >
              LOGOUT
            </button>
          </div>
        </div>

        {/* Compact Profile Summary */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-16 h-16 rounded-full p-0.5 border-2 border-blue-500 border-dashed mb-2.5 flex items-center justify-center shadow-xs">
            {user?.avatar_url ? (
              <Image src={user.avatar_url} alt="Profile" fill className="rounded-full object-cover p-0.5" unoptimized />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-lg font-black text-white shadow-sm shadow-blue-500/20">
                {displayName.charAt(0)}
              </div>
            )}
          </div>
          <h2 className="text-sm font-extrabold text-center text-slate-900 leading-tight">
            Bonjour {displayName}
          </h2>
          <p className="text-[11px] text-slate-400 text-center mt-0.5 max-w-[180px] leading-snug">
            {t('continue_journey')}
          </p>
          
          <div className="flex gap-2.5 mt-3.5">
            <Link 
              href="/calendar" 
              className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50/80 flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-xs" 
              title="Notifications & Calendrier"
            >
              <Bell size={14} />
            </Link>
            <Link 
              href="/classroom" 
              className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50/80 flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-xs" 
              title="Classe Virtuelle"
            >
              <MessageSquare size={14} />
            </Link>
            <Link 
              href="/inbox" 
              className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50/80 flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-xs" 
              title="Messagerie & Courrier"
            >
              <Mail size={14} />
            </Link>
          </div>
        </div>

        {/* Compact Your Mentor Section */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-xs">{t('your_mentor')}</h3>
            <button className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600">
              <Plus size={12} />
            </button>
          </div>
          
          <div className="space-y-2.5">
            {mentors.length > 0 ? (
              mentors.map((mentor, idx) => {
                const mentorName = mentor.email ? mentor.email.split('@')[0] : `Mentor #${mentor.id}`;
                return (
                  <div key={mentor.id || idx} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Image src={`https://ui-avatars.com/api/?name=${mentorName}&background=2563eb&color=fff`} alt={mentorName} width={28} height={28} className="rounded-full" />
                      <div>
                        <p className="text-[11px] font-bold text-slate-900 truncate max-w-[85px]">{mentorName}</p>
                        <p className="text-[9px] text-slate-400 leading-none">Instructor</p>
                      </div>
                    </div>
                    <button className="px-2 py-0.5 text-[10px] font-bold bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-full transition-colors shadow-xs">
                      {t('follow')}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-[11px] text-slate-400 text-center py-3">No mentors available yet</p>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}
