'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlayCircle, BookOpen, ChevronLeft, ChevronRight, Play, ArrowRight } from 'lucide-react';
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
  instructor?: { id: number; email: string; role: string };
}

interface Enrollment {
  id: number;
  user_id: number;
  course_id: number;
  enrolled_at: string;
  course?: Course;
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        // Fetch enrollments
        const enrollmentsRes = await apiClient.get('/enrollments/me');
        const enrollmentsData = enrollmentsRes.data;
        const coursesWithDetails = await Promise.all(
          enrollmentsData.map(async (enrollment: Enrollment) => {
            try {
              const courseRes = await apiClient.get(`/courses/${enrollment.course_id}`);
              return { ...enrollment, course: courseRes.data };
            } catch {
              return enrollment;
            }
          })
        );
        setEnrollments(coursesWithDetails);

        // Fetch all courses for the mentor table
        const coursesRes = await apiClient.get('/courses/');
        setAllCourses(coursesRes.data);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 ml-64 mr-80 p-8">
        
        {/* Banner (High-Tech PC AI Server with Light/Dark Adaptive Styles) */}
        <div className="w-full relative rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden mb-8 border border-red-500/20 dark:border-red-500/30 shadow-xl dark:shadow-2xl shadow-red-950/10 dark:shadow-red-950/40 min-h-[170px] group transition-all">
          
          {/* Light Mode Tech Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 dark:hidden"
            style={{ backgroundImage: "url('/images/hd_tech_ai_server_light.jpg')" }}
          />

          {/* Dark Mode Tech Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 hidden dark:block"
            style={{ backgroundImage: "url('/images/hd_tech_ai_server.jpg')" }}
          />

          {/* Dynamic Overlay Gradient: Clean white in light mode, obsidian cyber in dark mode */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/40 dark:from-[#09090b]/95 dark:via-[#09090b]/80 dark:to-[#09090b]/40 backdrop-blur-[1px]" />
          
          {/* Ambient Glows */}
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-red-500/10 dark:bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-rose-500/10 dark:bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Banner Text Content */}
          <div className="space-y-2 z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30 dark:border-red-500/40 text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400 animate-pulse" />
              <span>{t('online_course')} • PC, AI & SERVEURS HAUTE PERFORMANCE</span>
            </div>
            <h1 className="text-slate-900 dark:text-white text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight drop-shadow-sm dark:drop-shadow-md">
              {t('title')}
            </h1>
            <p className="text-slate-700 dark:text-gray-300 text-xs sm:text-sm font-medium">
              Explorez nos modules de pointe en intelligence artificielle, calcul quantique et architectures serveurs.
            </p>
          </div>

          {/* Action Button */}
          <Link 
            href="/courses" 
            className="z-10 px-6 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-2.5 text-white bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:from-red-500 hover:to-rose-500 hover:scale-105 transition-all shadow-lg shadow-red-600/25 dark:shadow-red-600/35 border border-red-400/30 w-fit shrink-0"
          >
            <span>{t('join_now')}</span>
            <span className="bg-white/20 text-white rounded-full p-1"><Play size={10} fill="currentColor" /></span>
          </Link>
        </div>

        {/* Assiduité & Performances Académiques (Journalier, Mensuel, Semestriel) */}
        <AttendancePerformanceWidget />

        {/* Progress Cards — based on real enrollments */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {enrollments.length > 0 ? enrollments.slice(0, 3).map(enr => {
            const course = enr.course;
            if (!course) return null;
            return (
              <Link key={enr.id} href={`/courses/${course.id}`} className="bg-surface rounded-2xl p-4 flex items-center gap-4 border border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <BookOpen size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-secondary">{t('watched')}</p>
                  <p className="font-bold text-sm truncate">{course.title}</p>
                </div>
                <ArrowRight size={16} className="text-text-secondary shrink-0" />
              </Link>
            );
          }) : (
            <div className="col-span-3 bg-surface rounded-2xl p-6 flex items-center gap-4 border border-dashed border-border">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">No courses yet</p>
                <p className="text-xs text-text-secondary">Explore and enroll in courses to see your progress here.</p>
              </div>
            </div>
          )}
        </div>

        {/* Continue Watching — real enrolled courses */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">{t('continue_watching')}</h2>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-secondary hover:bg-surface hover:text-primary"><ChevronLeft size={16} /></button>
              <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-secondary hover:bg-surface hover:text-primary"><ChevronRight size={16} /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {enrollments.length > 0 ? enrollments.map(enr => {
              const course = enr.course;
              if (!course) return null;
              return (
                <Link key={enr.id} href={`/courses/${course.id}`} className="bg-surface rounded-2xl p-4 border border-border shadow-sm group cursor-pointer hover:shadow-md transition-shadow block">
                  <div className="w-full h-40 relative rounded-xl overflow-hidden mb-4 bg-background">
                    {course.cover_image_url ? (
                      <Image src={course.cover_image_url} alt={course.title} fill className="object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><PlayCircle size={40} className="text-border" /></div>
                    )}
                    <div className="absolute top-3 right-3 w-8 h-8 bg-background/50 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-primary transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </div>
                  </div>
                  
                  <span className="px-2 py-1 text-[10px] font-bold bg-primary/10 text-primary rounded-sm uppercase tracking-wider inline-block mb-3">
                    Course
                  </span>
                  
                  <h3 className="font-bold text-sm mb-4 line-clamp-2 h-10">{course.title}</h3>
                  
                  <div className="flex items-center gap-2 pt-4 border-t border-border">
                    <Image src={`https://ui-avatars.com/api/?name=${course.instructor?.email?.split('@')[0] || course.instructor_id}&background=random`} alt="Formateur" width={24} height={24} className="rounded-full" />
                    <div>
                      <p className="text-[10px] font-bold">{course.instructor?.email?.split('@')[0] || `Formateur #${course.instructor_id}`}</p>
                      <p className="text-[9px] text-text-secondary">Instructor</p>
                    </div>
                  </div>
                </Link>
              );
            }) : (
              <div className="col-span-3 text-center p-8 text-text-secondary border border-dashed border-border rounded-2xl">
                <PlayCircle size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium">No active courses</p>
                <p className="text-sm mt-1">
                  <Link href="/courses" className="text-primary hover:underline">Browse courses</Link> and enroll to get started!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Courses & Instructors Table — real data from API */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">{t('your_mentor')}</h2>
            <Link href="/courses" className="text-primary text-sm font-bold hover:underline">{t('see_all')}</Link>
          </div>
          
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-text-secondary text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">{t('mentor_name')}</th>
                  <th className="px-6 py-4">{t('course_type')}</th>
                  <th className="px-6 py-4">{t('course_title')}</th>
                  <th className="px-6 py-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allCourses.length > 0 ? allCourses.slice(0, 5).map(course => {
                  const instructorName = course.instructor?.email 
                    ? course.instructor.email.split('@')[0]
                    : `Formateur #${course.instructor_id}`;
                  return (
                    <tr key={course.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <Image src={`https://ui-avatars.com/api/?name=${instructorName}&background=8b5cf6&color=fff`} alt="Mentor" width={32} height={32} className="rounded-full" />
                        <div>
                          <p className="font-bold">{instructorName}</p>
                          <p className="text-[10px] text-text-secondary">Instructor</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-[10px] font-bold bg-primary/10 text-primary rounded-sm uppercase tracking-wider">COURSE</span>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {course.title}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/courses/${course.id}`} className="px-4 py-2 text-[10px] font-bold bg-background border border-border text-primary rounded-lg hover:bg-primary/10 transition-colors">
                          {t('show_details')}
                        </Link>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                      No courses available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <RightPanel />
    </div>
  );
}
