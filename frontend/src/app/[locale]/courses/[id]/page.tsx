'use client';

import { useEffect, useState, useRef } from 'react';
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Users, ArrowLeft, Star, Clock, CheckCircle, Loader2, PlayCircle, Plus, Trash2, Upload, Video, Sparkles } from "lucide-react";
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
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoDescription, setNewVideoDescription] = useState('');
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setNewVideoFile(file);
      setUploadError('');
      if (!newVideoTitle) {
        setNewVideoTitle(file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
      }
    } else {
      setUploadError("Le fichier déposé n'est pas une vidéo valide.");
    }
  };

  const handleDeleteCourse = async () => {
    if (!confirm("Attention : Voulez-vous vraiment supprimer ce cours ? Cette action supprimera également toutes les vidéos associées et est irréversible.")) return;
    setIsDeletingCourse(true);
    try {
      await apiClient.delete(`/courses/${id}`);
      router.push('/courses');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression du cours.");
    } finally {
      setIsDeletingCourse(false);
    }
  };

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
        setActiveVideo(prev => {
          if (!prev || !data.videos.some((v: CourseVideo) => v.id === prev.id)) {
            return data.videos[0];
          }
          return prev;
        });
      } else {
        setActiveVideo(null);
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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoFile) {
      setUploadError("Veuillez sélectionner un fichier vidéo.");
      return;
    }
    
    setIsUploadingVideo(true);
    setUploadError('');
    try {
      // 1. Upload video file to server
      const formData = new FormData();
      formData.append('file', newVideoFile);
      
      const uploadRes = await apiClient.post('/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const videoUrl = uploadRes.data.url;

      // 2. Add video metadata to course videos list
      const nextOrder = (course?.videos?.length || 0) + 1;
      const addRes = await apiClient.post(`/courses/${id}/videos`, {
        title: newVideoTitle,
        description: newVideoDescription || '',
        video_url: videoUrl,
        order_index: nextOrder
      });

      // Refresh course data
      await fetchCourse();
      
      // Close modal and clear form
      setIsUploadModalOpen(false);
      setNewVideoTitle('');
      setNewVideoDescription('');
      setNewVideoFile(null);
      
      // Set the newly uploaded video as active
      if (addRes.data) {
        setActiveVideo(addRes.data);
      }
    } catch (err) {
      console.error(err);
      setUploadError("Erreur lors de l'upload de la vidéo. Assurez-vous que le fichier est valide.");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleDeleteVideo = async (videoId: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cette vidéo ?")) return;
    try {
      await apiClient.delete(`/courses/${id}/videos/${videoId}`);
      
      // Clear active video if it was deleted
      if (activeVideo?.id === videoId) {
        setActiveVideo(null);
      }
      
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

  const isCourseManager = ['admin', 'admin_manager', 'admin_limited'].includes(currentUser?.role || '') || currentUser?.id === course.instructor_id;

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
          <Link href="/courses" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6 w-fit">
            <ArrowLeft size={20} />
            Back to Courses
          </Link>
          <span className="px-3 py-1 text-xs font-semibold bg-primary/20 text-primary border border-primary/30 rounded-full w-fit mb-4">
            Course
          </span>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-md text-text-primary">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-text-secondary text-sm font-medium">
            <div className="flex items-center gap-2 text-text-primary">
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
      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        
        {/* 1. Horizontal Action & Enrollment Banner */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles size={20} className="text-[#1877f2]" />
              <span>{isEnrolled ? 'Inscrit au cours !' : 'Rejoindre ce cours'}</span>
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              {isEnrolled 
                ? 'Vous avez un accès complet à tous les supports, vidéos et devoirs.' 
                : 'Inscrivez-vous pour accéder à toutes les ressources pédagogiques et vidéos.'}
            </p>

            {enrollError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-2.5 rounded-xl text-xs font-semibold">
                {enrollError}
              </div>
            )}
            {!isAuthenticated && !isEnrolled && (
              <p className="text-xs text-slate-500 pt-1">
                <Link href="/login" className="text-[#1877f2] font-bold hover:underline">Connectez-vous</Link> pour suivre ce cours.
              </p>
            )}
          </div>

          {/* Horizontal Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isEnrolled ? (
              <div className="px-5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold rounded-xl flex items-center gap-2 shadow-xs text-xs sm:text-sm">
                <CheckCircle size={17} className="text-emerald-600" />
                <span>Inscrit</span>
              </div>
            ) : (
              <button 
                onClick={handleEnroll}
                disabled={isEnrolling}
                className="px-6 py-2.5 bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99]"
              >
                {isEnrolling ? (
                  <><Loader2 size={16} className="animate-spin" /> Inscription...</>
                ) : (
                  <><BookOpen size={16} /> S'inscrire au cours</>
                )}
              </button>
            )}

            {course.document_url && (
              <DownloadCourseButton documentUrl={course.document_url} />
            )}

            {isCourseManager && (
              <button 
                onClick={handleDeleteCourse}
                disabled={isDeletingCourse}
                className="py-2.5 px-4 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer text-xs disabled:opacity-50"
                title="Supprimer le cours"
              >
                {isDeletingCourse ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span>Supprimer</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Main Course Content Grid (Video + About + Playlist) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Video Player */}
            {activeVideo && (isEnrolled || isCourseManager) ? (
              <div className="w-full bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xl font-bold text-slate-900">{activeVideo.title}</h2>
                <YoutubePlayer src={activeVideo.video_url} title={activeVideo.title} />
              </div>
            ) : activeVideo && !isEnrolled ? (
              <div className="w-full aspect-video bg-white flex flex-col items-center justify-center rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
                <PlayCircle size={48} className="text-slate-400 mb-3" />
                <p className="text-slate-600 text-sm font-medium">Inscrivez-vous pour visionner les vidéos de ce cours.</p>
              </div>
            ) : null}

            {/* About this course */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">About this course</h2>
              <div className="text-slate-600 leading-relaxed whitespace-pre-line text-sm">
                {course.description || "No detailed description is available for this course yet."}
              </div>
            </div>
          </div>

          {/* Playlist Section (Sidebar next to Description) */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 sticky top-24">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Playlist ({course.videos?.length || 0})</h3>
                {isCourseManager && (
                  <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#1877f2] border border-blue-200 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-100 transition-all cursor-pointer"
                    title="Ajouter une vidéo"
                  >
                    <Plus size={14} />
                    <span>Ajouter</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {!course.videos || course.videos.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Aucune vidéo disponible pour le moment.</p>
                ) : (
                  course.videos.map((video, index) => (
                    <div 
                      key={video.id}
                      onClick={() => setActiveVideo(video)}
                      className={`flex justify-between items-center p-3 rounded-xl cursor-pointer transition-colors ${
                        activeVideo?.id === video.id 
                          ? 'bg-blue-50 border border-blue-300 text-[#1877f2]' 
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          activeVideo?.id === video.id ? 'bg-[#1877f2] text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="text-xs font-semibold truncate">{video.title}</span>
                      </div>
                      {isCourseManager && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteVideo(video.id); }}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors ml-1"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
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

      {/* Upload Video Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-white/95 dark:bg-[#111413]/90 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl shadow-primary/10 space-y-4 text-xs animate-zoom-in">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Video size={18} className="text-primary" />
                <span>Ajouter une vidéo</span>
              </h3>
              <button 
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setNewVideoTitle('');
                  setNewVideoDescription('');
                  setNewVideoFile(null);
                  setUploadError('');
                }}
                className="text-text-secondary hover:text-text-primary transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            {uploadError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl font-semibold">
                {uploadError}
              </div>
            )}
            
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Titre de la vidéo
                </label>
                <input 
                  type="text" 
                  required
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none transition-all text-text-primary text-xs"
                  placeholder="Ex: 01 - Introduction au cours"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Description (Optionnelle)
                </label>
                <textarea 
                  rows={3}
                  value={newVideoDescription}
                  onChange={(e) => setNewVideoDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none transition-all text-text-primary text-xs resize-none"
                  placeholder="Décrivez brièvement le contenu de cette leçon..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Fichier Vidéo
                </label>
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative ${isDragging ? 'border-primary bg-primary/5 scale-[1.02] shadow-inner' : 'border-border bg-background hover:border-primary/50'}`}
                >
                  <input 
                    type="file" 
                    accept="video/*"
                    required={!newVideoFile}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setNewVideoFile(file);
                      if (file && !newVideoTitle) {
                        setNewVideoTitle(file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-3 text-text-secondary pointer-events-none">
                    <Upload size={28} className={`transition-transform duration-200 ${isDragging ? 'scale-110 text-primary' : 'text-primary/75'}`} />
                    <span className="font-semibold text-text-primary text-xs block truncate max-w-[250px]">
                      {newVideoFile ? newVideoFile.name : 'Déposez votre vidéo ici ou cliquez'}
                    </span>
                    {!newVideoFile && <span className="text-[10px]">Formats acceptés : MP4, WebM</span>}
                  </div>
                </div>
                {isUploadingVideo && (
                  <div className="w-full bg-border rounded-full h-1 mt-3 overflow-hidden">
                    <div className="bg-primary h-1 rounded-full animate-[pulse_1s_infinite] w-full" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setNewVideoTitle('');
                    setNewVideoDescription('');
                    setNewVideoFile(null);
                    setUploadError('');
                  }}
                  className="px-4 py-2 rounded-xl border border-border text-text-secondary hover:bg-surface-hover font-bold transition-all cursor-pointer text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUploadingVideo}
                  className="btn-primary py-2 px-5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"
                >
                  {isUploadingVideo ? (
                    <><Loader2 size={14} className="animate-spin" /> Téléchargement...</>
                  ) : (
                    'Ajouter'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
