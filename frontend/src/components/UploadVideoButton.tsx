'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Video, Loader2, Upload } from 'lucide-react';
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
            if (['formateur', 'admin', 'pedagogique'].includes(res.data.role)) {
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
  const myCourses = currentUser.role === 'admin' 
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-white/95 dark:bg-[#111413]/90 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl shadow-primary/10 space-y-4 text-xs animate-zoom-in">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Video size={18} className="text-primary" />
                <span>Téléverser une vidéo</span>
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setVideoTitle('');
                  setVideoDescription('');
                  setVideoFile(null);
                  setError('');
                }}
                className="text-text-secondary hover:text-text-primary transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Sélectionner le cours
                </label>
                {myCourses.length === 0 ? (
                  <p className="text-amber-500 font-semibold py-1">Vous n'avez créé aucun cours. Créez d'abord un cours avant d'y ajouter des vidéos.</p>
                ) : (
                  <select 
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none transition-all text-text-primary text-xs cursor-pointer"
                  >
                    {myCourses.map(course => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Titre de la vidéo
                </label>
                <input 
                  type="text" 
                  required
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none transition-all text-text-primary text-xs"
                  placeholder="Ex: 02 - Configuration de l'environnement"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Description (Optionnelle)
                </label>
                <textarea 
                  rows={3}
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none transition-all text-text-primary text-xs resize-none"
                  placeholder="Décrivez le contenu de cette leçon..."
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
                  <div className="flex flex-col items-center gap-3 text-text-secondary pointer-events-none">
                    <Upload size={28} className={`transition-transform duration-200 ${isDragging ? 'scale-110 text-primary' : 'text-primary/75'}`} />
                    <span className="font-semibold text-text-primary text-xs block truncate max-w-[250px]">
                      {videoFile ? videoFile.name : 'Déposez votre vidéo ici ou cliquez'}
                    </span>
                    {!videoFile && <span className="text-[10px]">Formats acceptés : MP4, WebM</span>}
                  </div>
                </div>
                {isUploading && (
                  <div className="w-full bg-border rounded-full h-1 mt-3 overflow-hidden">
                    <div className="bg-primary h-1 rounded-full animate-[pulse_1s_infinite] w-full" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setVideoTitle('');
                    setVideoDescription('');
                    setVideoFile(null);
                    setError('');
                  }}
                  className="px-4 py-2 rounded-xl border border-border text-text-secondary hover:bg-surface-hover font-bold transition-all cursor-pointer text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUploading || myCourses.length === 0}
                  className="btn-primary py-2 px-5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
