'use client';

import { useEffect, useState } from 'react';
import { 
  Award, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  BarChart3, 
  Users, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Loader2, 
  Check, 
  FileQuestion, 
  ShieldCheck, 
  Sparkles, 
  BookOpen,
  Download,
  FileText,
  History,
  GraduationCap,
  ExternalLink,
  Eye,
  CheckCircle,
  XCircle,
  FileCheck2,
  Settings2,
  UploadCloud,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useConfirm } from '@/context/ConfirmModalContext';
import { isStaff } from '@/lib/roles';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
interface AssignedGroup {
  id: number;
  name: string;
  level?: string;
}

interface AssessmentChoice {
  id: string;
  question_id: string;
  content: string;
}

interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  content: string;
  points: number;
  order_index: number;
  choices: AssessmentChoice[];
}

interface Assessment {
  id: string;
  title: string;
  description?: string;
  type: 'QUIZ' | 'CERTIFICATION';
  is_standard_recommended: boolean;
  time_limit_minutes: number;
  passing_score_percentage: number;
  show_corrections_after: boolean;
  certificate_template_url?: string;
  created_by: number;
  creator_name?: string;
  created_at: string;
  updated_at?: string;
  question_count: number;
  total_points: number;
  assigned_groups: AssignedGroup[];
  has_completed: boolean;
  best_score?: number;
  is_passed: boolean;
  latest_attempt_id?: string;
  certificate_url?: string;
}

interface ChoiceReview {
  id: string;
  question_id: string;
  content: string;
  is_correct: boolean;
}

interface QuestionReview {
  id: string;
  assessment_id: string;
  content: string;
  points: number;
  order_index: number;
  choices: ChoiceReview[];
  user_selected_choice_id?: string;
  is_user_correct: boolean;
  points_earned: number;
}

interface AttemptReview {
  attempt_id: string;
  assessment_id: string;
  assessment_title: string;
  assessment_type: string;
  passing_score_percentage: number;
  score_percentage: number;
  is_passed: boolean;
  status: string;
  started_at: string;
  completed_at?: string;
  total_points_earned: number;
  total_points_possible: number;
  show_corrections: boolean;
  certificate_url?: string;
  questions: QuestionReview[];
}

interface UserCertificate {
  id: string;
  user_id: number;
  user_name?: string;
  user_email?: string;
  assessment_id: string;
  assessment_title: string;
  attempt_id: string;
  score_percentage: number;
  certificate_file_url: string;
  issued_at: string;
}

// Question Builder structure
interface BuilderQuestion {
  content: string;
  points: number;
  choices: Array<{
    content: string;
    is_correct: boolean;
  }>;
}

export default function QuizzesPage() {
  const { confirm } = useConfirm();

  // Helper de résolution universelle des URLs de certificats
  const getCertificateUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const backendBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/api\/v1\/?$/, '');
    return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Auth User
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string; prenom?: string; nom?: string; group_name?: string } | null>(null);

  // Data
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [certificates, setCertificates] = useState<UserCertificate[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: number; name: string; level?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'assessments' | 'certificates' | 'history'>('assessments');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'QUIZ' | 'CERTIFICATION'>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');

  // Examination Player State
  const [activeExam, setActiveExam] = useState<{
    attemptId: string;
    assessment: Assessment;
    questions: AssessmentQuestion[];
  } | null>(null);
  const [examQuestionIndex, setExamQuestionIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<{ [questionId: string]: string }>({});
  const [examTimeLeftSeconds, setExamTimeLeftSeconds] = useState<number>(0);
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);

  // Post-Exam Review / Feedback State
  const [reviewResult, setReviewResult] = useState<AttemptReview | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Certificate Modal Preview
  const [previewCertUrl, setPreviewCertUrl] = useState<string | null>(null);

  // Creator Builder State (Modal)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<'QUIZ' | 'CERTIFICATION'>('CERTIFICATION');
  const [isStandardRecommended, setIsStandardRecommended] = useState(true);
  const [newTimeLimit, setNewTimeLimit] = useState(30);
  const [newPassingScore, setNewPassingScore] = useState(70);
  const [newShowCorrections, setNewShowCorrections] = useState(true);
  const [newCertificateTemplateUrl, setNewCertificateTemplateUrl] = useState<string | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [builderQuestions, setBuilderQuestions] = useState<BuilderQuestion[]>([
    {
      content: '',
      points: 5,
      choices: [
        { content: '', is_correct: true },
        { content: '', is_correct: false },
        { content: '', is_correct: false },
        { content: '', is_correct: false }
      ]
    }
  ]);
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);

  // RBAC Permission Check
  const canManage = isStaff(currentUser?.role);

  // 1. Initial Data Fetching
  const fetchData = async () => {
    try {
      const [userRes, asmRes, certRes, grpRes] = await Promise.all([
        apiClient.get('/users/me').catch(() => null),
        apiClient.get('/assessments/').catch(() => ({ data: [] })),
        apiClient.get('/assessments/certificates/my-certificates').catch(() => ({ data: [] })),
        apiClient.get('/groups/').catch(() => ({ data: [] }))
      ]);

      if (userRes?.data) setCurrentUser(userRes.data);
      if (asmRes?.data) setAssessments(asmRes.data);
      if (certRes?.data) setCertificates(certRes.data);
      if (grpRes?.data && Array.isArray(grpRes.data)) setAvailableGroups(grpRes.data);
    } catch (err) {
      console.error('Error fetching assessments data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Standard Recommended Settings Handler
  const handleToggleStandardRecommended = (enabled: boolean) => {
    setIsStandardRecommended(enabled);
    if (enabled) {
      setNewPassingScore(70);
      setNewTimeLimit(30);
      setNewShowCorrections(true);
    }
  };

  // 3. Template Upload Handler
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTemplate(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/assessments/upload-template', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.template_url) {
        setNewCertificateTemplateUrl(res.data.template_url);
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors du téléversement du modèle de certificat.");
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  // 4. Start Exam / Attempt
  const handleStartExam = async (asm: Assessment) => {
    try {
      setIsLoading(true);
      const res = await apiClient.post(`/assessments/${asm.id}/start`);
      const startData = res.data;

      setActiveExam({
        attemptId: startData.attempt_id,
        assessment: startData.assessment,
        questions: startData.assessment.questions || []
      });
      setExamQuestionIndex(0);
      setExamAnswers({});
      setReviewResult(null);
      setExamTimeLeftSeconds((startData.time_limit_minutes || 30) * 60);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors du démarrage de l'évaluation.");
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Timer countdown for active examination
  useEffect(() => {
    if (!activeExam || reviewResult) return;

    if (examTimeLeftSeconds <= 0) {
      handleAutoSubmitExam();
      return;
    }

    const timer = setInterval(() => {
      setExamTimeLeftSeconds(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeExam, examTimeLeftSeconds, reviewResult]);

  const handleAutoSubmitExam = async () => {
    if (!activeExam || isSubmittingExam) return;
    handleSubmitExam(true);
  };

  // 6. Submit Exam Answers
  const handleSubmitExam = async (isAuto: boolean = false) => {
    if (!activeExam) return;

    if (!isAuto) {
      const unansweredCount = activeExam.questions.length - Object.keys(examAnswers).length;
      if (unansweredCount > 0) {
        const ok = await confirm({
          title: "Soumettre l'examen ?",
          description: `Attention : vous n'avez pas répondu à ${unansweredCount} question(s) sur ${activeExam.questions.length}. Voulez-vous tout de même finaliser votre tentative ?`,
          confirmText: "Finaliser et soumettre",
          cancelText: "Poursuivre l'examen",
          variant: "danger",
          badgeText: "Examen E-Schola Pro",
          icon: "warning"
        });
        if (!ok) return;
      }
    }

    setIsSubmittingExam(true);
    try {
      const res = await apiClient.post(
        `/assessments/${activeExam.assessment.id}/submit?attempt_id=${activeExam.attemptId}`,
        { answers: examAnswers }
      );
      setReviewResult(res.data);
      setActiveExam(null); // Quitte le mode player
      fetchData(); // Rafraîchit les scores et certificats
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la soumission de l'évaluation.");
    } finally {
      setIsSubmittingExam(false);
    }
  };

  // 7. Inspect Review (Feedback)
  const handleOpenReview = async (attemptId: string) => {
    setIsLoadingReview(true);
    try {
      const res = await apiClient.get(`/assessments/attempts/${attemptId}/review`);
      setReviewResult(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors du chargement de la correction.");
    } finally {
      setIsLoadingReview(false);
    }
  };

  // 8. Delete Assessment (Creator)
  const handleDeleteAssessment = async (asm: Assessment) => {
    const ok = await confirm({
      title: "Supprimer cette évaluation ?",
      description: `Êtes-vous certain de vouloir supprimer définitivement "${asm.title}" ? Toutes les questions, tentatives et résultats d'apprenants associés seront effacés.`,
      confirmText: "Supprimer définitivement",
      cancelText: "Annuler",
      variant: "danger",
      badgeText: asm.type === 'CERTIFICATION' ? "Examen de Certification" : "Quiz Formatif",
      itemName: asm.title,
      icon: "trash"
    });
    if (!ok) return;

    try {
      await apiClient.delete(`/assessments/${asm.id}`);
      setAssessments(prev => prev.filter(a => a.id !== asm.id));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la suppression.");
    }
  };

  // 9. Add Question to Builder
  const handleAddQuestion = () => {
    setBuilderQuestions(prev => [
      ...prev,
      {
        content: '',
        points: 5,
        choices: [
          { content: '', is_correct: true },
          { content: '', is_correct: false },
          { content: '', is_correct: false },
          { content: '', is_correct: false }
        ]
      }
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (builderQuestions.length <= 1) return;
    setBuilderQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSetCorrectChoice = (qIndex: number, choiceIndex: number) => {
    setBuilderQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      q.choices = q.choices.map((c, i) => ({
        ...c,
        is_correct: i === choiceIndex
      }));
      updated[qIndex] = q;
      return updated;
    });
  };

  // 10. Submit Creation
  const handleCreateAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Veuillez renseigner un titre pour l'évaluation.");
      return;
    }

    // Validation des questions
    for (let i = 0; i < builderQuestions.length; i++) {
      const q = builderQuestions[i];
      if (!q.content.trim()) {
        alert(`Veuillez renseigner l'énoncé de la Question #${i + 1}`);
        return;
      }
      const validChoices = q.choices.filter(c => c.content.trim() !== '');
      if (validChoices.length < 2) {
        alert(`La Question #${i + 1} doit comporter au moins 2 choix de réponse valides.`);
        return;
      }
      const hasCorrect = validChoices.some(c => c.is_correct);
      if (!hasCorrect) {
        alert(`Veuillez sélectionner au moins une bonne réponse pour la Question #${i + 1}`);
        return;
      }
    }

    setIsCreatingAssessment(true);
    try {
      const payload = {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        type: newType,
        is_standard_recommended: isStandardRecommended,
        time_limit_minutes: isStandardRecommended ? 30 : newTimeLimit,
        passing_score_percentage: isStandardRecommended ? 70.0 : newPassingScore,
        show_corrections_after: isStandardRecommended ? true : newShowCorrections,
        certificate_template_url: newCertificateTemplateUrl,
        assigned_group_ids: selectedGroupIds,
        questions: builderQuestions.map(q => ({
          content: q.content.trim(),
          points: q.points || 1,
          choices: q.choices.filter(c => c.content.trim() !== '').map(c => ({
            content: c.content.trim(),
            is_correct: c.is_correct
          }))
        }))
      };

      await apiClient.post('/assessments/', payload);
      setShowCreateModal(false);
      // Reset form
      setNewTitle('');
      setNewDescription('');
      setNewCertificateTemplateUrl(null);
      setSelectedGroupIds([]);
      setBuilderQuestions([
        {
          content: '',
          points: 5,
          choices: [
            { content: '', is_correct: true },
            { content: '', is_correct: false },
            { content: '', is_correct: false },
            { content: '', is_correct: false }
          ]
        }
      ]);
      fetchData();
      alert("Évaluation créée et publiée avec succès !");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la création de l'évaluation.");
    } finally {
      setIsCreatingAssessment(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Filtered Assessments
  const filteredAssessments = assessments.filter(asm => {
    if (typeFilter !== 'ALL' && asm.type !== typeFilter) return false;
    if (groupFilter !== 'ALL') {
      const gId = parseInt(groupFilter, 10);
      const isAssigned = asm.assigned_groups.some(g => g.id === gId);
      if (!isAssigned && asm.assigned_groups.length > 0) return false;
    }
    return true;
  });

  if (isLoading && assessments.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  // =========================================================================
  // RENDER 1 : MODE EXAMEN IMMERSIF (PLAYER)
  // =========================================================================
  if (activeExam) {
    const qCount = activeExam.questions.length;
    const currentQ = activeExam.questions[examQuestionIndex];
    const isUrgentTimer = examTimeLeftSeconds < 300; // moins de 5 min

    return (
      <div className="min-h-screen bg-background text-text-primary px-4 py-8 max-w-4xl mx-auto space-y-6">
        {/* Header Examen */}
        <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                activeExam.assessment.type === 'CERTIFICATION'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-primary/10 text-primary border border-primary/30'
              }`}>
                {activeExam.assessment.type === 'CERTIFICATION' ? 'Examen de Certification Officiel' : 'Quiz Formatif'}
              </span>
              <span className="text-xs text-text-secondary">
                Question {examQuestionIndex + 1} sur {qCount}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-text-primary">
              {activeExam.assessment.title}
            </h1>
          </div>

          {/* Chronomètre */}
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border font-mono text-base font-bold ${
            isUrgentTimer
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
              : 'bg-primary/10 text-primary border-primary/20'
          }`}>
            <Clock size={18} />
            <span>{formatTimer(examTimeLeftSeconds)}</span>
          </div>
        </div>

        {/* Barre de Progression */}
        <div className="w-full bg-surface-raised h-2.5 rounded-full overflow-hidden border border-border">
          <div 
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${((examQuestionIndex + 1) / qCount) * 100}%` }}
          />
        </div>

        {/* Carte de la Question Actuelle */}
        {currentQ && (
          <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border space-y-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-primary">
                  Question #{examQuestionIndex + 1}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-text-primary leading-relaxed">
                  {currentQ.content}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-surface-raised border border-border shrink-0">
                {currentQ.points} pt{currentQ.points > 1 ? 's' : ''}
              </span>
            </div>

            {/* Choix Multiples */}
            <div className="space-y-3 pt-2">
              {currentQ.choices.map((choice, cIdx) => {
                const isSelected = examAnswers[currentQ.id] === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setExamAnswers(prev => ({ ...prev, [currentQ.id]: choice.id }))}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-md shadow-primary/10'
                        : 'bg-surface-raised/60 hover:bg-surface-raised border-border/80 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                        isSelected
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-text-muted bg-surface'
                      }`}>
                        {String.fromCharCode(65 + cIdx)}
                      </div>
                      <span className={`text-sm sm:text-base ${isSelected ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>
                        {choice.content}
                      </span>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-primary bg-primary text-white' : 'border-border'
                    }`}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions de Navigation */}
        <div className="flex items-center justify-between gap-4 pt-4">
          <button
            type="button"
            disabled={examQuestionIndex === 0}
            onClick={() => setExamQuestionIndex(prev => Math.max(0, prev - 1))}
            className="px-5 py-2.5 rounded-xl border border-border text-sm font-bold flex items-center gap-2 hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowLeft size={16} /> Précédente
          </button>

          <div className="flex items-center gap-3">
            {examQuestionIndex < qCount - 1 ? (
              <button
                type="button"
                onClick={() => setExamQuestionIndex(prev => Math.min(qCount - 1, prev + 1))}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
              >
                Suivante <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmittingExam}
                onClick={() => handleSubmitExam(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {isSubmittingExam ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Finaliser & Soumettre l'examen
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER 2 : ÉCRAN DE RÉSULTAT & FEEDBACK POST-EXAMEN
  // =========================================================================
  if (reviewResult) {
    const isPassed = reviewResult.is_passed;
    const isCert = reviewResult.assessment_type === 'CERTIFICATION';

    return (
      <div className="min-h-screen px-4 pt-28 pb-20 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Bannière de Résultat */}
        <div className={`p-8 rounded-3xl border shadow-2xl relative overflow-hidden ${
          isPassed
            ? 'bg-gradient-to-br from-emerald-500/10 via-surface to-surface border-emerald-500/30'
            : 'bg-gradient-to-br from-rose-500/10 via-surface to-surface border-rose-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-surface border border-border">
                {isCert ? <GraduationCap size={14} className="text-amber-400" /> : <Award size={14} className="text-primary" />}
                <span>{reviewResult.assessment_title}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-text-primary">
                {isPassed 
                  ? (isCert ? 'Félicitations ! Vous êtes certifié !' : 'Bravo ! Évaluation réussie !') 
                  : 'Évaluation terminée — Seuil non atteint'}
              </h1>
              <p className="text-sm text-text-secondary max-w-md">
                {isPassed
                  ? (isCert 
                      ? "Votre réussite valide officiellement vos compétences. Votre diplôme officiel haute définition a été généré avec succès."
                      : "Vous avez brillamment validé les objectifs pédagogiques de ce quiz.")
                  : `Votre score de ${reviewResult.score_percentage}% est inférieur au seuil requis de ${reviewResult.passing_score_percentage}%. Vous pouvez réviser et retenter l'examen.`}
              </p>
            </div>

            {/* Score Badge */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-surface border border-border/80 shadow-lg text-center shrink-0 min-w-[160px]">
              <span className="text-xs font-bold uppercase text-text-secondary mb-1">Score Final</span>
              <span className={`text-4xl font-black ${isPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {reviewResult.score_percentage}%
              </span>
              <span className="text-xs text-text-muted mt-1 font-medium">
                {reviewResult.total_points_earned} / {reviewResult.total_points_possible} pts
              </span>
              <span className="text-[11px] text-text-secondary mt-1">
                Seuil requis : {reviewResult.passing_score_percentage}%
              </span>
            </div>
          </div>

          {/* Bouton de Téléchargement du Diplôme si Réussi & Certifié */}
          {isPassed && isCert && reviewResult.certificate_url && (
            <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <CheckCircle size={18} />
                <span>Diplôme Officiel E-Schola Pro généré & certifié</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewCertUrl(reviewResult.certificate_url!)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-border hover:bg-surface-raised flex items-center gap-2 cursor-pointer"
                >
                  <Eye size={15} /> Aperçu Grand Format
                </button>
                <a
                  href={getCertificateUrl(reviewResult.certificate_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Download size={15} /> Télécharger mon Diplôme (Haute Définition)
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Feedback Détaillé Question par Question (Vert / Rouge) */}
        {reviewResult.show_corrections && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-text-primary">
                  Correction Détaillée & Feedback
                </h2>
                <p className="text-xs text-text-secondary">
                  Comparez vos réponses avec les solutions attendues.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface border border-border">
                {reviewResult.questions.length} questions analysées
              </span>
            </div>

            <div className="space-y-4">
              {reviewResult.questions.map((q, qIdx) => {
                return (
                  <div
                    key={q.id}
                    className={`p-6 rounded-2xl border transition-all ${
                      q.is_user_correct
                        ? 'bg-surface border-emerald-500/30'
                        : 'bg-surface border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2.5">
                        {q.is_user_correct ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={16} />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                            <XCircle size={16} />
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-bold text-text-secondary uppercase">
                            Question #{qIdx + 1}
                          </span>
                          <h3 className="text-base font-bold text-text-primary">
                            {q.content}
                          </h3>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
                        q.is_user_correct
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {q.points_earned} / {q.points} pt{q.points > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Choix avec coloration Vert/Rouge */}
                    <div className="space-y-2 pt-1">
                      {q.choices.map((c, cIdx) => {
                        const isUserPick = q.user_selected_choice_id === c.id;
                        const isCorrectAnswer = c.is_correct;

                        let styleClasses = "bg-surface-raised/40 border-border/70 text-text-secondary";
                        let badgeLabel = null;

                        if (isUserPick && isCorrectAnswer) {
                          // L'utilisateur a bien choisi la bonne réponse
                          styleClasses = "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold";
                          badgeLabel = (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                              <CheckCircle2 size={14} /> Votre réponse (Correcte)
                            </span>
                          );
                        } else if (isUserPick && !isCorrectAnswer) {
                          // L'utilisateur a choisi une mauvaise réponse
                          styleClasses = "bg-rose-500/10 border-rose-500 text-rose-400 font-bold";
                          badgeLabel = (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                              <XCircle size={14} /> Votre réponse (Incorrecte)
                            </span>
                          );
                        } else if (!isUserPick && isCorrectAnswer) {
                          // La bonne réponse que l'utilisateur n'a pas choisie
                          styleClasses = "bg-emerald-500/5 border-emerald-500/40 text-emerald-300 font-medium";
                          badgeLabel = (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                              <CheckCircle2 size={14} /> Réponse attendue
                            </span>
                          );
                        }

                        return (
                          <div
                            key={c.id}
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm ${styleClasses}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded-full border border-current/30 flex items-center justify-center text-xs shrink-0">
                                {String.fromCharCode(65 + cIdx)}
                              </span>
                              <span>{c.content}</span>
                            </div>
                            {badgeLabel}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bouton Retour */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setReviewResult(null)}
            className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
          >
            Retour au Centre d'Évaluations
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER 3 : VUE PRINCIPALE DU CENTRE D'ÉVALUATION & CERTIFICATION
  // =========================================================================
  return (
    <div className="min-h-screen px-4 pt-28 pb-20 max-w-7xl mx-auto space-y-8">
      {/* 1. Header & Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-2">
            <Award size={14} />
            <span>MODULE UNIFIÉ D'ÉVALUATION & ACCRÉDITATIONS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary">
            Examens & <span className="text-brand-gradient">Certifications Officielles</span>
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl mt-1">
            Évaluez vos compétences avec des QCM formatifs et décrochez des diplômes de certification certifiés avec délivrance automatique.
          </p>
        </div>

        {/* Bouton de création réservé aux créateurs (RBAC) */}
        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
            >
              <Plus size={16} /> Créer une Évaluation / Examen
            </button>
          </div>
        )}
      </div>

      {/* 2. Onglets Principaux */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('assessments')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'assessments'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
        >
          <BookOpen size={15} />
          <span>Évaluations Disponibles ({assessments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('certificates')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'certificates'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
          }`}
        >
          <GraduationCap size={15} />
          <span>Mes Diplômes & Certificats ({certificates.length})</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* ONGLET 1 : ÉVALUATIONS & EXAMENS                                      */}
      {/* ===================================================================== */}
      {activeTab === 'assessments' && (
        <div className="space-y-6">
          {/* Barre de Filtres */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-border">
            {/* Filtre Type */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-secondary">Type :</span>
              <div className="flex items-center bg-surface-raised p-1 rounded-xl border border-border">
                <button
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    typeFilter === 'ALL' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setTypeFilter('QUIZ')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    typeFilter === 'QUIZ' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Quiz Formatifs
                </button>
                <button
                  onClick={() => setTypeFilter('CERTIFICATION')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    typeFilter === 'CERTIFICATION' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Certifications
                </button>
              </div>
            </div>

            {/* Filtre Groupe */}
            {availableGroups.length > 0 && (
              <div className="flex items-center gap-2">
                <Users size={15} className="text-text-secondary" />
                <span className="text-xs font-bold text-text-secondary">Groupe :</span>
                <select
                  value={groupFilter}
                  onChange={e => setGroupFilter(e.target.value)}
                  className="bg-surface-raised border border-border text-text-primary text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="ALL">Toutes les cohortes</option>
                  {availableGroups.map(g => (
                    <option key={g.id} value={g.id.toString()}>
                      {g.name} {g.level ? `(${g.level})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Grille des Évaluations */}
          {filteredAssessments.length === 0 ? (
            <div className="p-12 rounded-3xl bg-surface border border-border text-center space-y-4">
              <FileQuestion size={48} className="mx-auto text-text-muted" />
              <h3 className="text-lg font-bold text-text-primary">Aucune évaluation correspondante</h3>
              <p className="text-xs text-text-secondary max-w-md mx-auto">
                Aucune évaluation n'est actuellement disponible pour ce filtre ou assignée à votre groupe d'apprentissage.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssessments.map(asm => {
                const isCert = asm.type === 'CERTIFICATION';
                return (
                  <div
                    key={asm.id}
                    className="p-6 rounded-3xl bg-surface border border-border hover:border-primary/50 transition-all flex flex-col justify-between space-y-5 shadow-lg group relative overflow-hidden"
                  >
                    {/* Top Badges */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          isCert
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-primary/10 text-primary border border-primary/30'
                        }`}>
                          {isCert ? <GraduationCap size={13} /> : <BookOpen size={13} />}
                          <span>{isCert ? 'Certification' : 'Quiz Formatif'}</span>
                        </span>

                        {asm.is_standard_recommended && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Sparkles size={11} /> Standard
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">
                        {asm.title}
                      </h3>

                      {asm.description && (
                        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                          {asm.description}
                        </p>
                      )}
                    </div>

                    {/* Paramètres Clés */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface-raised border border-border/60 text-xs">
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Clock size={14} className="text-text-muted shrink-0" />
                        <span>{asm.time_limit_minutes} min</span>
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Award size={14} className="text-text-muted shrink-0" />
                        <span>Seuil : {asm.passing_score_percentage}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary">
                        <FileQuestion size={14} className="text-text-muted shrink-0" />
                        <span>{asm.question_count} questions</span>
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary">
                        <BarChart3 size={14} className="text-text-muted shrink-0" />
                        <span>{asm.total_points} points</span>
                      </div>
                    </div>

                    {/* Groupes assignés */}
                    {asm.assigned_groups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {asm.assigned_groups.map(g => (
                          <span key={g.id} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-raised border border-border text-text-muted">
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Statut & Actions */}
                    <div className="pt-3 border-t border-border space-y-3">
                      {asm.has_completed ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Meilleur score :</span>
                            <span className={`font-bold ${asm.is_passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {asm.best_score}% {asm.is_passed ? '(Validé)' : '(Non validé)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Bouton Diplôme si Certifié */}
                            {asm.is_passed && isCert && asm.certificate_url && (
                              <a
                                href={getCertificateUrl(asm.certificate_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer"
                              >
                                <GraduationCap size={14} /> Mon Diplôme
                              </a>
                            )}

                            {/* Bouton Correction */}
                            {asm.latest_attempt_id && (
                              <button
                                type="button"
                                onClick={() => handleOpenReview(asm.latest_attempt_id!)}
                                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold border border-border hover:bg-surface-raised flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Eye size={14} /> Correction
                              </button>
                            )}

                            {/* Bouton Retenter */}
                            <button
                              type="button"
                              onClick={() => handleStartExam(asm)}
                              className="py-2 px-3 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Retenter l'évaluation"
                            >
                              Retenter
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartExam(asm)}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold btn-primary flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                        >
                          <span>{isCert ? "Passer l'Examen de Certification" : "Commencer le Quiz"}</span>
                          <ArrowRight size={15} />
                        </button>
                      )}

                      {/* Action Supprimer pour Formateur/Admin */}
                      {canManage && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-text-muted">Par : {asm.creator_name || 'Formateur'}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAssessment(asm)}
                            className="text-text-muted hover:text-rose-400 text-xs p-1 rounded transition-colors cursor-pointer"
                            title="Supprimer l'évaluation"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ONGLET 2 : MES DIPLÔMES & CERTIFICATS                                */}
      {/* ===================================================================== */}
      {activeTab === 'certificates' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-surface to-surface border border-amber-500/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <GraduationCap size={14} />
                <span>RÉPERTOIRE DES ACCRÉDITATIONS OFFICIELLES</span>
              </div>
              <h2 className="text-2xl font-black text-text-primary">
                Vos Diplômes & Certificats de Compétences
              </h2>
              <p className="text-xs text-text-secondary max-w-xl">
                Tous les diplômes générés après avoir obtenu un score supérieur ou égal au seuil de passage de 70% lors de vos examens certifiants.
              </p>
            </div>
            <div className="px-6 py-4 rounded-2xl bg-surface border border-border text-center shrink-0">
              <span className="text-3xl font-black text-amber-400">{certificates.length}</span>
              <p className="text-xs text-text-secondary font-medium">Diplôme{certificates.length > 1 ? 's' : ''} obtenu{certificates.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          {certificates.length === 0 ? (
            <div className="p-12 rounded-3xl bg-surface border border-border text-center space-y-4">
              <GraduationCap size={48} className="mx-auto text-amber-400/50" />
              <h3 className="text-lg font-bold text-text-primary">Aucun diplôme obtenu pour le moment</h3>
              <p className="text-xs text-text-secondary max-w-md mx-auto">
                Passez un examen certifiant disponible dans l'onglet "Évaluations Disponibles" et obtenez une note ≥ 70% pour déclencher la génération automatique de votre diplôme officiel.
              </p>
              <button
                type="button"
                onClick={() => { setActiveTab('assessments'); setTypeFilter('CERTIFICATION'); }}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                Explorer les examens de certification
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map(cert => (
                <div
                  key={cert.id}
                  className="rounded-3xl bg-surface border border-border overflow-hidden shadow-xl hover:border-amber-500/50 transition-all flex flex-col justify-between group"
                >
                  {/* Aperçu du document */}
                  <div className="relative aspect-[3/2] bg-slate-950 overflow-hidden border-b border-border">
                    <img
                      src={getCertificateUrl(cert.certificate_file_url)}
                      alt={cert.assessment_title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                      <span className="font-bold flex items-center gap-1.5 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg border border-amber-500/30">
                        <GraduationCap size={13} className="text-amber-400" />
                        Score : {cert.score_percentage}%
                      </span>
                      <span className="text-[10px] text-white/80 bg-slate-900/80 backdrop-blur px-2 py-1 rounded-md">
                        {new Date(cert.issued_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>

                  {/* Informations */}
                  <div className="p-5 space-y-4">
                    <div>
                      <h3 className="text-base font-black text-text-primary line-clamp-1">
                        {cert.assessment_title}
                      </h3>
                      <p className="text-xs text-text-secondary mt-1">
                        Délivré à : <strong className="text-text-primary">{cert.user_name || cert.user_email}</strong>
                      </p>
                      <p className="text-[10px] font-mono text-text-muted mt-0.5">
                        ID: {cert.id.substring(0, 16)}...
                      </p>
                    </div>

                    {/* Actions de Téléchargement & Aperçu */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <a
                        href={getCertificateUrl(cert.certificate_file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer"
                      >
                        <Download size={14} /> Télécharger
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewCertUrl(cert.certificate_file_url)}
                        className="p-2 rounded-xl border border-border hover:bg-surface-raised text-text-secondary hover:text-text-primary cursor-pointer"
                        title="Aperçu Grand Format"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1 : ATELIER DE CRÉATION D'ÉVALUATION (CRÉATEURS UNIQUEMENT)      */}
      {/* ===================================================================== */}
      {showCreateModal && canManage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Atelier Pédagogique
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-text-primary">
                  Concevoir une Nouvelle Évaluation
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-raised cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAssessmentSubmit} className="space-y-6">
              {/* Type d'évaluation */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Type d'évaluation
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewType('QUIZ')}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      newType === 'QUIZ'
                        ? 'bg-primary/10 border-primary text-text-primary shadow-sm'
                        : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <BookOpen size={20} className={newType === 'QUIZ' ? 'text-primary' : 'text-text-muted'} />
                    <div>
                      <h4 className="text-sm font-bold">Quiz Formatif</h4>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        Test régulier d'apprentissage sans délivrance de diplôme officiel.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('CERTIFICATION')}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      newType === 'CERTIFICATION'
                        ? 'bg-amber-500/10 border-amber-500 text-text-primary shadow-sm'
                        : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <GraduationCap size={20} className={newType === 'CERTIFICATION' ? 'text-amber-400' : 'text-text-muted'} />
                    <div>
                      <h4 className="text-sm font-bold">Examen de Certification</h4>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        Génération automatique d'un diplôme officiel pour tout score ≥ 70%.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Titre & Description */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    Titre de l'évaluation *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Ex: Certification DevOps, Cloud & Architecture Conteneurisée"
                    className="w-full mt-1.5 px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    Description & Consignes pédagogiques
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Ex: 10 questions pour évaluer vos acquis techniques sur les pipelines CI/CD."
                    className="w-full mt-1.5 px-4 py-2 rounded-xl bg-surface-raised border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* TOGGLE PRESTATION STANDARD RECOMMANDÉE */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">
                      Appliquer la Prestation Standard Recommandée
                    </h4>
                    <p className="text-xs text-text-secondary">
                      Configure en 1 clic le standard académique E-Schola : Seuil de réussite à 70%, 30 minutes de durée, corrections affichées après soumission.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isStandardRecommended}
                    onChange={e => handleToggleStandardRecommended(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Paramètres Avancés (Si Prestation Standard désactivée) */}
              {!isStandardRecommended && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-surface-raised border border-border">
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase">
                      Durée limite (min)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={newTimeLimit}
                      onChange={e => setNewTimeLimit(parseInt(e.target.value, 10) || 30)}
                      className="w-full mt-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-text-primary text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase">
                      Seuil de passage (%)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={newPassingScore}
                      onChange={e => setNewPassingScore(parseFloat(e.target.value) || 70)}
                      className="w-full mt-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-text-primary text-xs"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-2 text-xs font-bold text-text-secondary cursor-pointer mt-4">
                      <input
                        type="checkbox"
                        checked={newShowCorrections}
                        onChange={e => setNewShowCorrections(e.target.checked)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span>Afficher la correction</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Si Certification : Option de Template Custom */}
              {newType === 'CERTIFICATION' && (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GraduationCap size={16} className="text-amber-400" />
                      <h4 className="text-xs font-bold text-text-primary uppercase">
                        Modèle Visuel de Diplôme (Template)
                      </h4>
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {newCertificateTemplateUrl ? 'Modèle personnalisé actif' : 'Modèle officiel Royal Navy & Gold par défaut'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 rounded-xl text-xs font-bold bg-surface-raised border border-border hover:border-amber-500/50 flex items-center gap-2 cursor-pointer">
                      {isUploadingTemplate ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      <span>Téléverser une maquette personnalisée</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleTemplateUpload}
                        className="hidden"
                      />
                    </label>
                    {newCertificateTemplateUrl && (
                      <button
                        type="button"
                        onClick={() => setNewCertificateTemplateUrl(null)}
                        className="text-xs text-rose-400 hover:underline cursor-pointer"
                      >
                        Rétablir le modèle officiel par défaut
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Assignation Cohorte / Groupes */}
              {availableGroups.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    Assignation aux Groupes / Cohortes (Optionnel)
                  </label>
                  <p className="text-[11px] text-text-muted">
                    Laissez vide pour rendre l'évaluation accessible à tous les apprenants.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {availableGroups.map(g => {
                      const isSelected = selectedGroupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setSelectedGroupIds(prev => 
                              isSelected ? prev.filter(id => id !== g.id) : [...prev, g.id]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-surface-raised text-text-secondary border-border hover:text-text-primary'
                          }`}
                        >
                          {g.name} {g.level ? `(${g.level})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Constructeur de Questions QCM */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-text-primary">
                      Questions de l'Évaluation ({builderQuestions.length})
                    </h3>
                    <p className="text-xs text-text-secondary">
                      Définissez l'énoncé, les choix et cochez la bonne réponse.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> Ajouter une question
                  </button>
                </div>

                <div className="space-y-4">
                  {builderQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="p-5 rounded-2xl bg-surface-raised border border-border space-y-4 relative">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-extrabold text-primary uppercase">
                          Question #{qIdx + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-text-secondary">Points :</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={q.points}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10) || 1;
                                setBuilderQuestions(prev => {
                                  const updated = [...prev];
                                  updated[qIdx].points = val;
                                  return updated;
                                });
                              }}
                              className="w-14 px-2 py-1 rounded-lg bg-surface border border-border text-xs text-center text-text-primary"
                            />
                          </div>

                          {builderQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(qIdx)}
                              className="text-text-muted hover:text-rose-400 p-1 cursor-pointer"
                              title="Supprimer cette question"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Énoncé */}
                      <input
                        type="text"
                        required
                        value={q.content}
                        onChange={e => {
                          const val = e.target.value;
                          setBuilderQuestions(prev => {
                            const updated = [...prev];
                            updated[qIdx].content = val;
                            return updated;
                          });
                        }}
                        placeholder={`Énoncé de la question #${qIdx + 1}`}
                        className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />

                      {/* Choix QCM */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-bold text-text-secondary uppercase">
                          Options de réponse (Sélectionnez le bouton radio pour marquer la bonne réponse) :
                        </span>
                        {q.choices.map((c, cIdx) => (
                          <div key={cIdx} className="flex items-center gap-3">
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={c.is_correct}
                              onChange={() => handleSetCorrectChoice(qIdx, cIdx)}
                              className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                              title="Cocher pour définir comme bonne réponse"
                            />
                            <input
                              type="text"
                              value={c.content}
                              onChange={e => {
                                const val = e.target.value;
                                setBuilderQuestions(prev => {
                                  const updated = [...prev];
                                  updated[qIdx].choices[cIdx].content = val;
                                  return updated;
                                });
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + cIdx)}${c.is_correct ? ' (Bonne réponse attendue)' : ''}`}
                              className={`flex-1 px-3 py-2 rounded-xl text-xs border bg-surface ${
                                c.is_correct
                                  ? 'border-emerald-500/60 font-bold text-emerald-300'
                                  : 'border-border text-text-secondary'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-border hover:bg-surface-raised cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAssessment}
                  className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                >
                  {isCreatingAssessment ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Publier l'évaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2 : APERÇU GRAND FORMAT DU DIPLÔME                               */}
      {/* ===================================================================== */}
      {previewCertUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-4xl w-full p-4 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <GraduationCap size={16} /> Diplôme Officiel E-Schola Pro
              </span>
              <button
                type="button"
                onClick={() => setPreviewCertUrl(null)}
                className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-raised cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-border aspect-[3/2] bg-slate-950">
              <img
                src={getCertificateUrl(previewCertUrl)}
                alt="Aperçu du diplôme"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <a
                href={getCertificateUrl(previewCertUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Download size={14} /> Télécharger le fichier original (PNG)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
