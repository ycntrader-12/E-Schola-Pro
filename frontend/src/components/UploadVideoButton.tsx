'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Plus, Video, Loader2, Upload, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Course {
  id: number;
  title: string;
  instructor_id: number;
}

interface UserMe {
  id: number;
  email: string;
  role: string;
}

interface UploadVideoButtonProps {
  courses: Course[];
}

export default function UploadVideoButton({ courses }: UploadVideoButtonProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserMe | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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
      setVideoFile(file);
      setError('');
      if (!videoTitle) {
        setVideoTitle(file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
      }
    } else {
      setError("Le fichier déposé n'est pas une vidéo valide.");
    }
  };

  useEffect(() => {
    const checkRole = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const res = await apiClient.get('/users/me');
          if (res.status === 200) {
            setCurrentUser(res.data);
            if (['formateur', 'admin', 'admin_manager', 'pedagogique'].includes(res.data.role)) {
              setCanUpload(true);
            }
          }
        } catch (e) {
          console.error('Failed to fetch user', e);
        }
      }
    };
    checkRole();
  }, []);

  if (!canUpload || !currentUser) return null;

  // Filter courses: Admins see all, trainers see only their own courses
  const myCourses = ['admin', 'admin_manager'].includes(currentUser.role) 
    ? courses 
    : courses.filter(c => c.instructor_id === currentUser.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setError("Veuillez sélectionner un cours.");
      return;
    }
    if (!videoFile) {
      setError("Veuillez sélectionner un fichier vidéo.");
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // 1. Upload video file to /upload/video
      const formData = new FormData();
      formData.append('file', videoFile);

      const uploadRes = await apiClient.post('/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const videoUrl = uploadRes.data.url;

      // 2. Fetch target course to get the current playlist length (for order_index)
      const courseDetailsRes = await apiClient.get(`/courses/${selectedCourseId}`);
      const courseVideosLength = courseDetailsRes.data.videos?.length || 0;

      // 3. Add video to course playlist
      await apiClient.post(`/courses/${selectedCourseId}/videos`, {
        title: videoTitle || videoFile.name,
        description: videoDescription || '',
        video_url: videoUrl,
        order_index: courseVideosLength + 1
      });

      // Clear form and close modal
      setIsModalOpen(false);
      setVideoTitle('');
      setVideoDescription('');
      setVideoFile(null);
      setSelectedCourseId('');

      // Redirect to course page so they see it in the playlist!
      router.push(`/courses/${selectedCourseId}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Erreur lors du téléversement de la vidéo.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => {
          setIsModalOpen(true);
          if (myCourses.length > 0) {
            setSelectedCourseId(String(myCourses[0].id));
          }
        }}
        className="px-6 py-3 rounded-xl font-semibold text-sm bg-surface border border-border text-text-primary hover:bg-surface-hover hover:border-primary/40 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
      >
        <Video size={18} className="text-primary" /> Ajouter une vidéo
      </button>

      {/* Upload Video Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 text-left animate-fade-in">
          <div className="relative w-full max-w-md p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-4 text-slate-900 animate-zoom-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 text-[#1877f2] flex items-center justify-center font-bold shrink-0">
                  <Video size={18} />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Téléverser une vidéo
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setVideoTitle('');
                  setVideoDescription('');
                  setVideoFile(null);
                  setError('');
                }}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-bold cursor-pointer"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl font-semibold text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sélectionner le cours *
                </label>
                {myCourses.length === 0 ? (
                  <p className="text-amber-600 font-semibold py-1 text-xs">Vous n'avez créé aucun cours. Créez d'abord un cours avant d'y ajouter des vidéos.</p>
                ) : (
                  <select 
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-900 text-xs font-medium cursor-pointer"
                  >
                    {myCourses.map(course => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Titre de la vidéo *
                </label>
                <input 
                  type="text" 
                  required
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-900 text-xs font-medium placeholder:text-slate-400"
                  placeholder="Ex: 02 - Configuration de l'environnement"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description (Optionnelle)
                </label>
                <textarea 
                  rows={3}
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-900 text-xs font-medium placeholder:text-slate-400 resize-none"
                  placeholder="Décrivez le contenu de cette leçon..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Fichier Vidéo *
                </label>
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative ${isDragging ? 'border-[#1877f2] bg-blue-50/80 scale-[1.01]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/80 hover:border-[#1877f2]/60'}`}
                >
                  <input 
                    type="file" 
                    accept="video/*"
                    required={!videoFile}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setVideoFile(file);
                      if (file && !videoTitle) {
                        setVideoTitle(file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-2.5 text-slate-600 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1877f2] flex items-center justify-center">
                      <Upload size={20} className={`transition-transform duration-200 ${isDragging ? 'scale-110' : ''}`} />
                    </div>
                    <span className="font-bold text-slate-900 text-xs block truncate max-w-[260px]">
                      {videoFile ? videoFile.name : 'Déposez votre vidéo ici ou cliquez'}
                    </span>
                    {!videoFile && <span className="text-[11px] text-slate-500 font-medium">Formats acceptés : MP4, WebM</span>}
                  </div>
                </div>
                {isUploading && (
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div className="bg-[#1877f2] h-full rounded-full animate-[pulse_1s_infinite] w-full" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setVideoTitle('');
                    setVideoDescription('');
                    setVideoFile(null);
                    setError('');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUploading || myCourses.length === 0}
                  className="btn-primary py-2.5 px-5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <><Loader2 size={14} className="animate-spin" /> Téléchargement...</>
                  ) : (
                    'Téléverser'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
