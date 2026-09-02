'use client';

import { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Send, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  Sparkles, 
  Calendar, 
  User, 
  GraduationCap, 
  ArrowLeft, 
  Award, 
  ExternalLink,
  ShieldCheck,
  Tag,
  Trash2,
  Edit3
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api';

interface TaskSubmission {
  id: number;
  task_id: number;
  user_id: number;
  content_link: string;
  status: string; // 'submitted', 'graded'
  grade?: number;
  feedback?: string;
  submitted_at: string;
  user_email?: string;
  user_role?: string;
}

interface TaskItem {
  id: number;
  title: string;
  description?: string;
  course_name: string;
  assigned_by_id: number;
  target_role: string;
  target_group: string;
  due_date: string;
  points: number;
  priority: string; // 'haute', 'moyenne', 'basse'
  created_at: string;
  assigned_by_email?: string;
  attachment_url?: string;
  my_submission?: TaskSubmission;
  total_submissions?: number;
}

export default function AssignmentsPage() {
  const tNav = useTranslations('Navigation');
  const tCommon = useTranslations('Common');
  const tRoles = useTranslations('Roles');

  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string } | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Submit modal state for Learners
  const [selectedTaskToSubmit, setSelectedTaskToSubmit] = useState<TaskItem | null>(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Task modal state for Trainers/Admins
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCourseName, setNewCourseName] = useState('Intelligence Artificielle & IA');
  const [newTargetRole, setNewTargetRole] = useState('all');
  const [newDueDate, setNewDueDate] = useState('2026-09-30');
  const [newPoints, setNewPoints] = useState(20);
  const [newPriority, setNewPriority] = useState('moyenne');
  const [newAttachment, setNewAttachment] = useState<File | null>(null);

  // Grade Submissions modal for Trainers/Admins
  const [selectedTaskToGrade, setSelectedTaskToGrade] = useState<TaskItem | null>(null);
  const [submissionsList, setSubmissionsList] = useState<TaskSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [gradingSubmissionId, setGradingSubmissionId] = useState<number | null>(null);
  const [gradeInput, setGradeInput] = useState<number>(18);
  const [feedbackInput, setFeedbackInput] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const userRes = await apiClient.get('/users/me');
      setCurrentUser(userRes.data);

      const tasksRes = await apiClient.get('/tasks/');
      setTasks(tasksRes.data);
    } catch (err) {
      console.error("Failed to load assignments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'formateur';

  // ---------------------------------------------------------------------------
  // GESTION DE LA SOUMISSION DU LIVRABLE (Apprenant)
  // ---------------------------------------------------------------------------
  // Cette fonction est appelée lorsqu'un étudiant valide l'envoi de son devoir.
  // Elle gère deux choses en une seule requête (si nécessaire) :
  // 1. L'upload du fichier physique vers le serveur (s'il y en a un).
  // 2. L'envoi du lien/texte et/ou du fichier uploadé vers la route /tasks/{id}/submit.
  // En arrière-plan, le backend va également déclencher une messagerie automatique.
  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskToSubmit) return;
    if (!submissionContent.trim() && !submissionFile) return;

    setIsSubmitting(true);
    try {
      let finalContentLink = submissionContent.trim();
      
      // Étape 1 : Si un fichier a été sélectionné, on l'uploade d'abord sur /upload/file
      if (submissionFile) {
        const formData = new FormData();
        formData.append('file', submissionFile);
        
        const uploadRes = await apiClient.post('/upload/file', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // On récupère l'URL du fichier retournée par le serveur
        const fileUrl = uploadRes.data.url;
        
        // Étape 2 : On combine le texte/lien existant avec l'URL du fichier
        if (finalContentLink) {
          finalContentLink += `\n\nFichier joint : ${fileUrl}`;
        } else {
          finalContentLink = fileUrl;
        }
      }

      // Étape 3 : On soumet le tout au devoir
      const res = await apiClient.post(`/tasks/${selectedTaskToSubmit.id}/submit`, {
        content_link: finalContentLink
      });

      // Étape 4 : Mise à jour de l'interface en temps réel
      setTasks(prev => prev.map(t => {
        if (t.id === selectedTaskToSubmit.id) {
          return { ...t, my_submission: res.data };
        }
        return t;
      }));

      // Réinitialisation de la modale
      setSelectedTaskToSubmit(null);
      setSubmissionContent('');
      setSubmissionFile(null);
      alert("Livrable soumis avec succès au corps pédagogique !");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la soumission du livrable.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Trainer Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreating(true);
    try {
      let attachmentUrl = null;
      if (newAttachment) {
        const formData = new FormData();
        formData.append('file', newAttachment);
        const uploadRes = await apiClient.post('/upload/file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        attachmentUrl = uploadRes.data.url;
      }

      const res = await apiClient.post('/tasks/', {
        title: newTitle,
        description: newDescription,
        course_name: newCourseName,
        target_role: newTargetRole,
        target_group: 'all',
        due_date: newDueDate,
        points: newPoints,
        priority: newPriority,
        attachment_url: attachmentUrl
      });

      setTasks(prev => [res.data, ...prev]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewAttachment(null);
      alert("Devoir créé et distribué aux apprenants ciblés !");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la création de la tâche.");
    } finally {
      setIsCreating(false);
    }
  };

  // Open Grading Drawer
  const handleOpenGrading = async (task: TaskItem) => {
    setSelectedTaskToGrade(task);
    setIsLoadingSubmissions(true);
    try {
      const res = await apiClient.get(`/tasks/${task.id}/submissions`);
      setSubmissionsList(res.data);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Submit Grade for a student
  const handleSaveGrade = async (subId: number) => {
    try {
      const res = await apiClient.put(`/tasks/submissions/${subId}/grade`, {
        grade: gradeInput,
        feedback: feedbackInput
      });

      setSubmissionsList(prev => prev.map(s => s.id === subId ? res.data : s));
      setGradingSubmissionId(null);
      alert("Note et appréciation enregistrées !");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de l'évaluation.");
    }
  };

  // Delete Task
  const handleDeleteTask = async (id: number) => {
    if (!confirm("Supprimer définitivement cette tâche ?")) return;
    try {
      await apiClient.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur de suppression.");
    }
  };

  // Filter Tasks
  const filteredTasks = tasks.filter(t => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const title = t.title.toLowerCase();
      const course = t.course_name.toLowerCase();
      const desc = (t.description || '').toLowerCase();
      if (!title.includes(query) && !course.includes(query) && !desc.includes(query)) return false;
    }

    if (roleFilter !== 'all' && t.target_role !== 'all' && t.target_role !== roleFilter) return false;

    if (!isManager) {
      if (filterTab === 'pending' && t.my_submission) return false;
      if (filterTab === 'submitted' && (!t.my_submission || t.my_submission.status !== 'submitted')) return false;
      if (filterTab === 'graded' && (!t.my_submission || t.my_submission.status !== 'graded')) return false;
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-[#1877f2]" size={36} />
      </div>
    );
  }

  // Stats computation for learners
  const myCompletedCount = tasks.filter(t => t.my_submission).length;
  const myGradedCount = tasks.filter(t => t.my_submission?.status === 'graded').length;
  const totalMyPoints = tasks.reduce((sum, t) => sum + (t.my_submission?.grade || 0), 0);
  const myAvgGrade = myGradedCount > 0 ? (totalMyPoints / myGradedCount).toFixed(1) : '—';

  return (
    <div className="min-h-screen pt-28 pb-20 px-4 max-w-7xl mx-auto space-y-8 select-none bg-slate-50/50">
      
      {/* 1. Header Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-[#1877f2] border border-blue-200 mb-2.5 shadow-xs">
            <CheckSquare size={14} />
            <span>ESPACE LIVRABLES &amp; TRAVAUX ACADÉMIQUES</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Tâches, Devoirs &amp; <span className="text-[#1877f2]">Livrables Officiels</span>
          </h1>
          <p className="text-slate-600 text-sm max-w-2xl mt-1">
            {isManager 
              ? "Attribuez des devoirs, consignes et projets à vos étudiants, stagiaires ou employés et évaluez leurs travaux en direct."
              : "Consultez l'ensemble des devoirs distribués par vos professeurs, soumettez vos livrables et suivez vos notes."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Créer un Devoir</span>
            </button>
          )}

          <Link
            href="/dashboard"
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>

      {/* 2. Learner Engagement Banner (Stats) */}
      {!isManager && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-extrabold uppercase">Tâches Attribuées</span>
              <CheckSquare size={16} className="text-[#1877f2]" />
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{tasks.length}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Devoirs reçus</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-extrabold uppercase">À Faire / En Cours</span>
              <Clock size={16} className="text-amber-500" />
            </div>
            <p className="text-3xl font-black text-amber-500 mt-2">{tasks.length - myCompletedCount}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Livrables en attente</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-extrabold uppercase">Soumis &amp; Validés</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="text-3xl font-black text-emerald-600 mt-2">{myCompletedCount}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Travaux envoyés</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-extrabold uppercase">Moyenne Obtenue</span>
              <Award size={16} className="text-indigo-500" />
            </div>
            <p className="text-3xl font-black text-indigo-600 mt-2">
              {myAvgGrade !== '—' ? `${myAvgGrade}/20` : '—'}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">{myGradedCount} devoir(s) noté(s)</p>
          </div>

        </div>
      )}

      {/* 3. Filters & Tabs Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        
        {/* Tabs */}
        {!isManager ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'Toutes les tâches' },
              { id: 'pending', label: 'À faire' },
              { id: 'submitted', label: 'Soumis' },
              { id: 'graded', label: 'Noté / Validé' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                  filterTab === tab.id
                    ? 'bg-[#1877f2] text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase text-slate-500">Filtrer par rôle ciblé :</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1877f2] text-slate-800 cursor-pointer font-semibold"
            >
              <option value="all">Tous les rôles</option>
              <option value="étudiant">{tRoles('etudiant')}</option>
              <option value="stagiaire">{tRoles('stagiaire')}</option>
              <option value="employer">{tRoles('employer')}</option>
            </select>
          </div>
        )}

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un devoir, matière..."
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1877f2] text-slate-800"
          />
        </div>

      </div>

      {/* 4. Tasks List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200">
            <CheckSquare size={32} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-base font-bold text-slate-700">Aucun devoir trouvé</h3>
            <p className="text-xs text-slate-400 mt-1">Vos devoirs et tâches apparaîtront ici.</p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const hasSubmitted = !!task.my_submission;
            const isGraded = task.my_submission?.status === 'graded';

            return (
              <div 
                key={task.id}
                className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group relative"
              >
                <div>
                  
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-[#1877f2] border border-blue-200 uppercase tracking-wider">
                      {task.course_name}
                    </span>

                    {/* Priority badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      task.priority === 'haute' 
                        ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                        : task.priority === 'basse'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>
                      Priorité {task.priority}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-[#1877f2] transition-colors leading-snug">
                    {task.title}
                  </h3>

                  {/* Description */}
                  {task.description && (
                    <p className="text-xs text-slate-600 line-clamp-3 mt-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Fichier joint */}
                  {task.attachment_url && (
                    <div className="mt-3">
                      <a 
                        href={task.attachment_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 hover:bg-blue-50 text-[#1877f2] border border-blue-100 text-[11px] font-extrabold transition-colors"
                      >
                        <FileText size={13} />
                        <span>Télécharger la pièce jointe</span>
                      </a>
                    </div>
                  )}

                  {/* Details */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#1877f2]" />
                        <span>Échéance : <strong>{task.due_date}</strong></span>
                      </span>
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {task.points} pts
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-slate-400">
                        <User size={12} />
                        <span>{task.assigned_by_email || 'Enseignant'}</span>
                      </span>
                      <span className="text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        Cible : {task.target_role === 'all' ? 'Tous' : task.target_role}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Bottom Actions & Status */}
                <div className="pt-3 border-t border-slate-100">
                  
                  {/* FOR LEARNERS */}
                  {!isManager && (
                    <div>
                      {isGraded ? (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase text-emerald-800 block">Note Validée</span>
                            <span className="text-xs text-emerald-700 font-medium italic">{task.my_submission?.feedback || 'Aucune remarque'}</span>
                          </div>
                          <span className="text-lg font-black text-emerald-700 bg-white px-2.5 py-1 rounded-lg shadow-xs">
                            {task.my_submission?.grade}/20
                          </span>
                        </div>
                      ) : hasSubmitted ? (
                        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-[#1877f2]" />
                            <span className="text-xs font-bold text-[#1877f2]">Livrable Soumis</span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedTaskToSubmit(task);
                              setSubmissionContent(task.my_submission?.content_link || '');
                            }}
                            className="text-[11px] font-extrabold text-[#1877f2] hover:underline cursor-pointer"
                          >
                            Modifier
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedTaskToSubmit(task);
                            setSubmissionContent('');
                            setSubmissionFile(null);
                          }}
                          className="w-full py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <Send size={14} />
                          <span>Déposer mon Livrable</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* FOR TRAINERS / ADMINS */}
                  {isManager && (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenGrading(task)}
                        className="flex-1 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#1877f2] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <FileText size={14} />
                        <span>Soumissions ({task.total_submissions || 0})</span>
                      </button>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                        title="Supprimer la tâche"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* 5. MODAL: SUBMIT DELIVERABLE (LEARNER) */}
      {selectedTaskToSubmit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-fade-in-up border border-slate-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-[#1877f2] bg-blue-50 px-2 py-0.5 rounded-md">
                  {selectedTaskToSubmit.course_name}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                  Déposer mon Livrable
                </h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedTaskToSubmit(null);
                  setSubmissionFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1">
              <p className="font-extrabold text-slate-900">{selectedTaskToSubmit.title}</p>
              <p className="text-slate-600 leading-relaxed">{selectedTaskToSubmit.description}</p>
              <p className="text-[11px] text-slate-400 pt-1">Date limite : {selectedTaskToSubmit.due_date} • {selectedTaskToSubmit.points} Points</p>
            </div>

            <form onSubmit={handleSubmitDeliverable} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Fichier joint (Optionnel)
                </label>
                <input
                  type="file"
                  onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#1877f2] hover:file:bg-blue-100 cursor-pointer"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.tar,.gz,.mp3,.wav,.mp4,.webm,.jpg,.jpeg,.png,.webp,.gif,.py,.js,.html,.css,.ts,.java,.cpp,.c"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lien ou Contenu du Livrable (GitHub, PDF, URL Drive, Compte-Rendu)
                </label>
                <textarea
                  rows={4}
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                  placeholder="Collez ici le lien GitHub, Google Drive, OneDrive ou la synthèse de votre devoir..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 outline-none shadow-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskToSubmit(null);
                    setSubmissionFile(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-extrabold flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={15} />}
                  <span>Confirmer l'Envoi</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 6. MODAL: CREATE TASK (TRAINER / ADMIN) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-fade-in-up border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-extrabold text-slate-900">
                Créer un Nouveau Devoir / Tâche
              </h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Intitulé du Devoir / Projet
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="ex: Projet Python & IA - Classification"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#1877f2] outline-none text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Matière / Cours Référent
                </label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  required
                  placeholder="ex: Intelligence Artificielle & IA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#1877f2] outline-none text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Public Ciblé (Rôle)
                  </label>
                  <select
                    value={newTargetRole}
                    onChange={(e) => setNewTargetRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#1877f2] outline-none text-slate-900 font-medium cursor-pointer"
                  >
                    <option value="all">Tous les apprenants</option>
                    <option value="étudiant">{tRoles('etudiant')}</option>
                    <option value="stagiaire">{tRoles('stagiaire')}</option>
                    <option value="employer">{tRoles('employer')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Date Limite de Remise
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#1877f2] outline-none text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Barème / Total Points
                  </label>
                  <input
                    type="number"
                    value={newPoints}
                    onChange={(e) => setNewPoints(parseInt(e.target.value) || 20)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#1877f2] outline-none text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Niveau de Priorité
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#1877f2] outline-none text-slate-900 font-medium cursor-pointer"
                  >
                    <option value="basse">Basse</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="haute">Haute (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Fichier joint (Optionnel : PDF, Word, Excel...)
                </label>
                <input
                  type="file"
                  onChange={(e) => setNewAttachment(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#1877f2] hover:file:bg-blue-100 cursor-pointer"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Consignes Détaillées &amp; Instructions
                </label>
                <textarea
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Décrivez précisément le travail à réaliser et les critères d'évaluation..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 focus:border-[#1877f2] outline-none text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-extrabold flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {isCreating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  <span>Créer le Devoir</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 7. MODAL: GRADE SUBMISSIONS (TRAINER / ADMIN) */}
      {selectedTaskToGrade && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-fade-in-up border border-slate-200 max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-[#1877f2] bg-blue-50 px-2 py-0.5 rounded-md">
                  Évaluation &amp; Correction
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                  Livrables pour : {selectedTaskToGrade.title}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedTaskToGrade(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingSubmissions ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="animate-spin mx-auto mb-2 text-[#1877f2]" size={28} />
                <p className="text-xs font-semibold">Chargement des livrables reçus...</p>
              </div>
            ) : submissionsList.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckSquare size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">Aucun livrable n'a encore été soumis par les apprenants.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissionsList.map(sub => (
                  <div key={sub.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1877f2] text-white flex items-center justify-center font-bold text-xs">
                          {sub.user_email?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs">{sub.user_email}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{sub.user_role} • Soumis le {new Date(sub.submitted_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {sub.status === 'graded' ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-extrabold">
                          Noté : {sub.grade}/20
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-extrabold">
                          En attente de note
                        </span>
                      )}
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 break-all">
                      {sub.content_link.startsWith('http') ? (
                        <a href={sub.content_link} target="_blank" rel="noreferrer" className="text-[#1877f2] font-bold hover:underline flex items-center gap-1">
                          <ExternalLink size={13} />
                          <span>{sub.content_link}</span>
                        </a>
                      ) : (
                        <span>{sub.content_link}</span>
                      )}
                    </div>

                    {/* Grading Form or Edit */}
                    {gradingSubmissionId === sub.id ? (
                      <div className="pt-2 space-y-3 bg-white p-4 rounded-xl border border-blue-200">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Note (/20)</label>
                            <input
                              type="number"
                              value={gradeInput}
                              onChange={(e) => setGradeInput(parseFloat(e.target.value) || 0)}
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Remarque / Appréciation</label>
                            <input
                              type="text"
                              value={feedbackInput}
                              onChange={(e) => setFeedbackInput(e.target.value)}
                              placeholder="ex: Excellent travail, code propre et documenté."
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs font-medium"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setGradingSubmissionId(null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleSaveGrade(sub.id)}
                            className="px-4 py-1.5 rounded-lg bg-[#1877f2] text-white text-xs font-extrabold"
                          >
                            Enregistrer la note
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setGradingSubmissionId(sub.id);
                            setGradeInput(sub.grade || 18);
                            setFeedbackInput(sub.feedback || '');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[#1877f2] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 size={13} />
                          <span>{sub.status === 'graded' ? 'Modifier la Note' : 'Noter ce Livrable'}</span>
                        </button>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
