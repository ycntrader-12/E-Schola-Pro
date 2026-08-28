'use client';

import { useEffect, useState, useRef } from 'react';
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Users, ArrowLeft, Star, Clock, CheckCircle, Loader2, PlayCircle, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import DownloadCourseButton from "@/components/DownloadCourseButton";
import YoutubePlayer from "@/components/video/YoutubePlayer";
import BackButton from "@/components/BackButton";

interface CourseVideo {
  id: number;
  title: string;
  description?: string;
  video_url: string;
}

interface Course {
  id: number;
  title: string;
  description: string;
  cover_image_url?: string;
  document_url?: string;
  instructor_id: number;
  instructor?: { email: string; role: string };
  videos?: CourseVideo[];
}

interface UserMe {
  id: number;
  email: string;
  role: string;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  
  const [currentUser, setCurrentUser] = useState<UserMe | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [activeVideo, setActiveVideo] = useState<CourseVideo | null>(null);
  
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCourse = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'}/courses/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setCourse(null);
        return;
      }
      const data = await res.json();
      setCourse(data);
      if (data.videos && data.videos.length > 0) {
        setActiveVideo(data.videos[0]);
      }
    } catch (error) {
      console.error("Error fetching course detail:", error);
      setCourse(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      setIsAuthenticated(true);
      try {
        const [meRes, enrollRes] = await Promise.all([
          apiClient.get('/users/me'),
          apiClient.get('/enrollments/me')
        ]);
        setCurrentUser(meRes.data);
        const enrolled = enrollRes.data.some((e: { course_id: number }) => e.course_id === Number(id));
        setIsEnrolled(enrolled);
      } catch {
        // Not logged in or error
      }
    };

    if (id) {
      fetchCourse();
      checkAuth();
    }
  }, [id]);

  const handleEnroll = async () => {
    setEnrollError('');
    const token = localStorage.getItem('access_token');
    if (!token) {
      setEnrollError('Veuillez vous connecter pour vous inscrire à ce cours.');
      return;
    }

    setIsEnrolling(true);
    try {
      await apiClient.post('/enrollments/', { course_id: Number(id) });
      setIsEnrolled(true);
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      setEnrollError(e.response?.data?.detail || 'Enrollment failed.');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    try {
      // 1. Upload file to /upload/video
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await apiClient.post('/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const videoUrl = uploadRes.data.url;

      // 2. Add video to course playlist
      const videoTitle = prompt("Titre de la vidéo :") || file.name;
      await apiClient.post(`/courses/${id}/videos`, {
        title: videoTitle,
        video_url: videoUrl,
        order_index: (course?.videos?.length || 0) + 1
      });

      // Refresh course
      await fetchCourse();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'upload de la vidéo.");
    } finally {
      setIsUploadingVideo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteVideo = async (videoId: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cette vidéo ?")) return;
    try {
      await apiClient.delete(`/courses/${id}/videos/${videoId}`);
      await fetchCourse();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <BookOpen size={48} className="text-text-secondary opacity-30" />
        <p className="text-xl font-bold">Course not found</p>
        <Link href="/courses" className="text-primary hover:underline">← Back to Courses</Link>
      </div>
    );
  }

  const instructorName = course.instructor?.email 
    ? course.instructor.email.split('@')[0] 
    : `Formateur #${course.instructor_id}`;

  const isCourseManager = currentUser?.role === 'admin' || currentUser?.id === course.instructor_id;

  return (
    <div className="min-h-screen pb-24">
      {/* Hero Section */}
      <div className="relative w-full h-[50vh] bg-surface flex items-center justify-center">
        {/* Back Button positioned absolute */}
        <div className="absolute top-6 left-6 z-10">
          <BackButton 
            className="bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg hover:bg-background border border-border/50" 
            label="Retour" 
            fallbackUrl="/courses" 
          />
        </div>
        {course.cover_image_url ? (
          <Image 
            src={course.cover_image_url} 
            alt={course.title}
            fill
            className="object-cover opacity-40"
            priority
          />
        ) : (
          <BookOpen size={100} className="text-white/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        
        <div className="absolute z-10 w-full max-w-5xl mx-auto px-4 inset-0 flex flex-col justify-end pb-12">
          <Link href="/courses" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-6 w-fit">
            <ArrowLeft size={20} />
            Back to Courses
          </Link>
          <span className="px-3 py-1 text-xs font-semibold bg-primary/20 text-primary border border-primary/30 rounded-full w-fit mb-4">
            Course
          </span>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-md">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-text-secondary text-sm font-medium">
            <div className="flex items-center gap-2 text-white">
              <Users size={18} />
              {instructorName}
            </div>
            <div className="flex items-center gap-2">
              <Star size={18} className="text-yellow-400" fill="currentColor" />
              5.0 (No reviews yet)
            </div>
            <div className="flex items-center gap-2">
              <Clock size={18} />
              Self-paced
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-5xl mx-auto px-4 pt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Video Player */}
          {activeVideo && (isEnrolled || isCourseManager) ? (
            <div className="w-full">
              <h2 className="text-2xl font-bold mb-4">{activeVideo.title}</h2>
              <YoutubePlayer src={activeVideo.video_url} title={activeVideo.title} />
            </div>
          ) : activeVideo && !isEnrolled ? (
            <div className="w-full aspect-video bg-surface flex flex-col items-center justify-center rounded-2xl border border-border">
              <PlayCircle size={48} className="text-text-secondary opacity-50 mb-4" />
              <p className="text-text-secondary">Inscrivez-vous pour visionner les vidéos de ce cours.</p>
            </div>
          ) : null}

          <div className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6">About this course</h2>
            <div className="text-text-secondary leading-relaxed whitespace-pre-line">
              {course.description || "No detailed description is available for this course yet."}
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 sticky top-24 border border-white/10">
            <h3 className="text-xl font-bold mb-4">
              {isEnrolled ? 'You are enrolled!' : 'Enroll in course'}
            </h3>
            <p className="text-text-secondary text-sm mb-6">
              {isEnrolled 
                ? 'You have full access to all materials, assignments, and discussions.' 
                : 'Join this course to get full access to all materials, assignments, and discussions.'}
            </p>

            {enrollError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm mb-4">
                {enrollError}
              </div>
            )}

            {isEnrolled ? (
              <button disabled className="w-full py-3 px-4 bg-green-600/20 text-green-400 border border-green-500/30 font-semibold rounded-lg flex items-center justify-center gap-2 cursor-default">
                <CheckCircle size={20} />
                Enrolled
              </button>
            ) : (
              <button 
                onClick={handleEnroll}
                disabled={isEnrolling}
                className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEnrolling ? (
                  <><Loader2 size={20} className="animate-spin" /> Enrolling...</>
                ) : (
                  <><BookOpen size={20} /> Enroll Now</>
                )}
              </button>
            )}

            {!isAuthenticated && !isEnrolled && (
              <p className="text-center text-xs text-text-secondary mt-4">
                <Link href="/login" className="text-primary hover:underline">Sign in</Link> to enroll in this course.
              </p>
            )}
            
            {course.document_url && (
              <div className="mt-4">
                <DownloadCourseButton documentUrl={course.document_url} />
              </div>
            )}
          </div>

          {/* Playlist Section */}
          <div className="glass-card p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Playlist ({course.videos?.length || 0})</h3>
              {isCourseManager && (
                <>
                  <input 
                    type="file" 
                    accept="video/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleVideoUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingVideo}
                    className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors"
                    title="Ajouter une vidéo"
                  >
                    {isUploadingVideo ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  </button>
                </>
              )}
            </div>

            <div className="space-y-2">
              {!course.videos || course.videos.length === 0 ? (
                <p className="text-sm text-text-secondary">Aucune vidéo disponible pour le moment.</p>
              ) : (
                course.videos.map((video, index) => (
                  <div 
                    key={video.id}
                    onClick={() => setActiveVideo(video)}
                    className={`flex justify-between items-center p-3 rounded-xl cursor-pointer transition-colors ${activeVideo?.id === video.id ? 'bg-primary/20 border border-primary/30' : 'bg-surface hover:bg-surface-hover'}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${activeVideo?.id === video.id ? 'bg-primary text-white' : 'bg-black/20 text-text-secondary'}`}>
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium truncate">{video.title}</span>
                    </div>
                    {isCourseManager && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteVideo(video.id); }}
                        className="text-text-secondary hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
