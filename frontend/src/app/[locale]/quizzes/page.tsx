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
  BookOpen
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Quiz {
  id: number;
  title: string;
  description?: string;
  creator_email?: string;
  target_roles: string;
  time_limit_minutes: number;
  question_count: number;
  total_points: number;
  is_completed: boolean;
  best_percentage?: number;
  created_at: string;
}

interface Question {
  id: number;
  question_text: string;
  options: string[];
  points: number;
  correct_option_index?: number;
}

interface QuizDetail extends Quiz {
  questions: Question[];
}

interface QuizAttempt {
  id: number;
  quiz_id: number;
  quiz_title?: string;
  user_email: string;
  user_role: string;
  score: number;
  max_score: number;
  percentage: number;
  completed_at: string;
}

export default function QuizzesPage() {
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string } | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'manage'>('available');

  // Taking a Quiz state
  const [activeQuizDetail, setActiveQuizDetail] = useState<QuizDetail | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [questionId: number]: number }>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<any | null>(null);

  // Formateur / Admin Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTimeLimit, setNewTimeLimit] = useState(15);
  const [newRoles, setNewRoles] = useState('étudiant,stagiaire,employer');
  const [newQuestions, setNewQuestions] = useState<Array<{
    question_text: string;
    options: string[];
    correct_option_index: number;
    points: number;
  }>>([
    {
      question_text: '',
      options: ['', '', '', ''],
      correct_option_index: 0,
      points: 5
    }
  ]);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);

  // Formateur Results Modal
  const [inspectQuizResults, setInspectQuizResults] = useState<{ quiz: Quiz; attempts: QuizAttempt[] } | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const canManage = currentUser?.role === 'formateur' || currentUser?.role === 'admin';

  // 1. Fetch User & Quizzes
  const fetchQuizzes = async () => {
    try {
      const [userRes, quizRes] = await Promise.all([
        apiClient.get('/users/me').catch(() => null),
        apiClient.get('/quizzes/')
      ]);
      if (userRes?.data) setCurrentUser(userRes.data);
      setQuizzes(quizRes.data);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // 2. Timer for active quiz
  useEffect(() => {
    if (!activeQuizDetail || quizResult) return;
    if (timeLeftSeconds <= 0) {
      handleAutoSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeftSeconds(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeQuizDetail, timeLeftSeconds, quizResult]);

  // 3. Start a Quiz
  const handleStartQuiz = async (quizId: number) => {
    try {
      setIsLoading(true);
      const res = await apiClient.get(`/quizzes/${quizId}`);
      setActiveQuizDetail(res.data);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setQuizResult(null);
      setTimeLeftSeconds(res.data.time_limit_minutes * 60);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors du chargement du quiz.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Submit Quiz
  const handleAutoSubmit = async () => {
    if (!activeQuizDetail || isSubmittingQuiz) return;
    submitQuizAnswers();
  };

  const submitQuizAnswers = async () => {
    if (!activeQuizDetail) return;
    setIsSubmittingQuiz(true);
    try {
      const res = await apiClient.post(`/quizzes/${activeQuizDetail.id}/submit`, {
        answers: selectedAnswers
      });
      setQuizResult(res.data);
      fetchQuizzes(); // Refresh scores on main list
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la soumission du quiz.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // 5. Delete Quiz (Formateur & Admin)
  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce quiz ?')) return;
    try {
      await apiClient.delete(`/quizzes/${quizId}`);
      setQuizzes(prev => prev.filter(q => q.id !== quizId));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la suppression.');
    }
  };

  // 6. View Results (Formateur & Admin)
  const handleInspectResults = async (quiz: Quiz) => {
    setIsLoadingResults(true);
    try {
      const res = await apiClient.get(`/quizzes/${quiz.id}/results`);
      setInspectQuizResults({ quiz, attempts: res.data });
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors du chargement des résultats.');
    } finally {
      setIsLoadingResults(false);
    }
  };

  // 7. Add Question to Builder
  const handleAddQuestionToBuilder = () => {
    setNewQuestions(prev => [
      ...prev,
      {
        question_text: '',
        options: ['', '', '', ''],
        correct_option_index: 0,
        points: 5
      }
    ]);
  };

  // 8. Submit New Quiz (Formateur & Admin)
  const handleCreateQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Validate questions
    for (let i = 0; i < newQuestions.length; i++) {
      const q = newQuestions[i];
      if (!q.question_text.trim()) {
        alert(`Veuillez renseigner le texte de la Question #${i + 1}`);
        return;
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) {
          alert(`Veuillez remplir l'option #${j + 1} de la Question #${i + 1}`);
          return;
        }
      }
    }

    setIsCreatingQuiz(true);
    try {
      await apiClient.post('/quizzes/', {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        time_limit_minutes: newTimeLimit,
        target_roles: newRoles,
        questions: newQuestions
      });

      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewQuestions([{
        question_text: '',
        options: ['', '', '', ''],
        correct_option_index: 0,
        points: 5
      }]);
      fetchQuizzes();
      alert('Quiz généré et publié avec succès pour les apprenants !');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la création du quiz.');
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  // Format timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (isLoading && quizzes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-28 pb-20 max-w-7xl mx-auto space-y-8">
      
      {/* 1. Header & Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-2">
            <Award size={14} />
            <span>ÉVALUATION & CERTIFICATION DES COMPÉTENCES</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary">
            Quiz & <span className="text-brand-gradient">Tests de Connaissances</span>
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl mt-1">
            Participez aux évaluations préparées par vos formateurs, obtenez vos notes en temps réel et validez vos compétences académiques et professionnelles.
          </p>
        </div>

        {/* Action Button for Formateurs & Admins */}
        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus size={16} /> Générer un nouveau Quiz
            </button>
          </div>
        )}
      </div>

      {/* 2. Navigation Tabs (Formateurs & Admins) */}
      {canManage && (
        <div className="flex items-center gap-3 border-b border-border pb-1">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'available'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
            }`}
          >
            Vue Apprenants (Passer les Quiz)
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
            }`}
          >
            <ShieldCheck size={15} />
            Gestion & Résultats des Apprenants ({quizzes.length})
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1 : VUE APPRENANTS (Étudiants, Stagiaires, Employés & Tous)      */}
      {/* ========================================================================= */}
      {activeTab === 'available' && (
        <div className="space-y-6">
          {quizzes.length === 0 ? (
            <div className="glass-card p-12 text-center text-text-secondary space-y-3">
              <HelpCircle size={40} className="mx-auto opacity-30 text-primary" />
              <p className="font-bold text-base text-text-primary">Aucun quiz disponible pour le moment</p>
              <p className="text-xs max-w-sm mx-auto">
                Les formateurs n'ont pas encore publié d'évaluation pour votre groupe. Revenez très bientôt !
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div 
                  key={quiz.id} 
                  className="glass-card p-6 flex flex-col justify-between space-y-5 hover:border-primary/50 transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                        <Clock size={13} className="text-primary" />
                        {quiz.time_limit_minutes} minutes
                      </span>

                      {quiz.is_completed ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Score : {quiz.best_percentage}%
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                          Nouveau • À passer
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors line-clamp-2">
                      {quiz.title}
                    </h3>

                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      {quiz.description || "Évaluation des compétences sur les notions abordées en cours."}
                    </p>

                    <div className="pt-2 flex items-center gap-3 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <FileQuestion size={14} className="text-primary" /> {quiz.question_count} Questions
                      </span>
                      <span>•</span>
                      <span>{quiz.total_points} Points au total</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-text-secondary">
                      Par {quiz.creator_email ? quiz.creator_email.split('@')[0] : 'Formateur'}
                    </span>

                    <button
                      onClick={() => handleStartQuiz(quiz.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        quiz.is_completed
                          ? 'bg-surface hover:bg-surface-hover border border-border text-text-primary'
                          : 'btn-primary'
                      }`}
                    >
                      <span>{quiz.is_completed ? 'Repasser le Quiz' : 'Passer le Quiz'}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2 : VUE FORMATEUR & ADMIN (Gestion des Quiz & Résultats)          */}
      {/* ========================================================================= */}
      {activeTab === 'manage' && canManage && (
        <div className="glass-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 bg-surface border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
              <ShieldCheck size={17} className="text-primary" />
              <span>Liste des Quiz Créés par les Formateurs</span>
            </h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus size={14} /> Créer un Quiz
            </button>
          </div>

          <div className="divide-y divide-border">
            {quizzes.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-xs">
                Aucun quiz créé pour le moment. Cliquez sur "Créer un Quiz" pour commencer.
              </div>
            ) : (
              quizzes.map((quiz) => (
                <div key={quiz.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface/50 transition-colors">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-text-primary">{quiz.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      <span>{quiz.question_count} questions ({quiz.total_points} pts)</span>
                      <span>•</span>
                      <span>Durée : {quiz.time_limit_minutes} min</span>
                      <span>•</span>
                      <span className="capitalize">Public : {quiz.target_roles.split(',').join(', ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleInspectResults(quiz)}
                      className="px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <BarChart3 size={14} />
                      <span>Consulter les Résultats</span>
                    </button>
                    <button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="p-2 rounded-xl text-text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Supprimer ce quiz"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : PASSER LE QUIZ EN DIRECT                                         */}
      {/* ========================================================================= */}
      {activeQuizDetail && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="glass-card max-w-2xl w-full p-6 sm:p-8 rounded-3xl border border-primary/40 shadow-2xl animate-fade-in-up my-auto max-h-[90vh] flex flex-col">
            
            {/* Quiz Result View */}
            {quizResult ? (
              <div className="text-center space-y-5 py-2 overflow-y-auto flex-1">
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white ${
                  quizResult.passed ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-rose-500 shadow-lg shadow-rose-500/30'
                }`}>
                  {quizResult.passed ? <Check size={32} /> : <AlertCircle size={32} />}
                </div>

                <div>
                  <h3 className="text-2xl font-extrabold text-text-primary">
                    {quizResult.passed ? 'Félicitations ! Évaluation Réussie' : 'Résultat Insuffisant'}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    {quizResult.passed 
                      ? 'Vous avez obtenu la note requise pour valider ce module.'
                      : 'Vous pouvez réviser le cours et retenter le quiz.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-around max-w-sm mx-auto">
                  <div>
                    <span className="text-xs text-text-secondary block">Score Obtenu</span>
                    <span className="text-xl font-black text-primary font-mono">{quizResult.score} / {quizResult.max_score}</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <span className="text-xs text-text-secondary block">Pourcentage</span>
                    <span className={`text-xl font-black font-mono ${quizResult.passed ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {quizResult.percentage}%
                    </span>
                  </div>
                </div>

                {/* Question Review */}
                <div className="max-h-56 overflow-y-auto space-y-3 text-left p-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Correction des questions :</h4>
                  {quizResult.review?.map((rev: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-surface border border-border text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary">Q{idx + 1}. {rev.question_text}</span>
                        <span className={rev.is_correct ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                          {rev.is_correct ? `+${rev.points} pts` : '0 pt'}
                        </span>
                      </div>
                      <p className="text-text-secondary">
                        Votre choix : <span className={rev.is_correct ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {rev.options[rev.selected_index] || 'Aucune réponse'}
                        </span>
                      </p>
                      {!rev.is_correct && (
                        <p className="text-emerald-500 font-semibold">
                          Bonne réponse : {rev.options[rev.correct_index]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setActiveQuizDetail(null);
                    setQuizResult(null);
                  }}
                  className="btn-primary w-full py-3 rounded-xl font-bold text-sm"
                >
                  Terminer & Retourner aux Quiz
                </button>
              </div>
            ) : (
              /* Quiz Taking Active Screen */
              <div className="flex flex-col h-full space-y-5 overflow-hidden">
                {/* Header with Title, Timer & Close */}
                <div className="flex items-center justify-between pb-3 border-b border-border gap-4 shrink-0">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-primary uppercase block">
                      Question {currentQuestionIndex + 1} sur {activeQuizDetail.questions.length}
                    </span>
                    <h3 className="text-base font-extrabold text-text-primary truncate">{activeQuizDetail.title}</h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary font-mono text-sm font-bold">
                      <Clock size={16} />
                      <span>{formatTimer(timeLeftSeconds)}</span>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm('Voulez-vous vraiment quitter ce quiz ? Vos réponses en cours ne seront pas enregistrées.')) {
                          setActiveQuizDetail(null);
                          setQuizResult(null);
                        }
                      }}
                      className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface border border-border transition-colors"
                      title="Quitter le quiz"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden shrink-0">
                  <div 
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIndex + 1) / activeQuizDetail.questions.length) * 100}%` }}
                  />
                </div>

                {/* Current Question - Scrollable */}
                {activeQuizDetail.questions[currentQuestionIndex] && (
                  <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                    <h4 className="text-base sm:text-lg font-bold text-text-primary">
                      {activeQuizDetail.questions[currentQuestionIndex].question_text}
                    </h4>

                    <div className="space-y-2.5">
                      {activeQuizDetail.questions[currentQuestionIndex].options.map((opt, optIdx) => {
                        const currentQId = activeQuizDetail.questions[currentQuestionIndex].id;
                        const isSelected = selectedAnswers[currentQId] === optIdx;

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setSelectedAnswers(prev => ({ ...prev, [currentQId]: optIdx }))}
                            className={`w-full p-3.5 sm:p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-primary/15 border-primary text-text-primary shadow-md shadow-primary/10'
                                : 'bg-surface border-border hover:bg-surface-hover text-text-secondary'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-medium pr-4">{opt}</span>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-primary bg-primary text-white' : 'border-border'
                            }`}>
                              {isSelected && <Check size={12} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bottom Navigation */}
                <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 flex items-center gap-1.5"
                  >
                    <ArrowLeft size={14} /> Précédent
                  </button>

                  {currentQuestionIndex < activeQuizDetail.questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:bg-primary-hover transition-colors"
                    >
                      <span>Suivant</span>
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={submitQuizAnswers}
                      disabled={isSubmittingQuiz}
                      className="btn-primary px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      {isSubmittingQuiz ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      <span>Valider & Obtenir Ma Note</span>
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : CONSULTER LES RÉSULTATS DES ÉTUDIANTS (Formateur / Admin)        */}
      {/* ========================================================================= */}
      {inspectQuizResults && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card max-w-2xl w-full p-6 rounded-3xl border border-primary/30 space-y-4 max-h-[85vh] flex flex-col animate-fade-in-up my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[11px] uppercase font-bold text-primary">RÉSULTATS DE L'ÉVALUATION</span>
                <h3 className="text-base font-bold text-text-primary">{inspectQuizResults.quiz.title}</h3>
              </div>
              <button 
                onClick={() => setInspectQuizResults(null)}
                className="text-text-secondary hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {inspectQuizResults.attempts.length === 0 ? (
                <div className="p-8 text-center text-text-secondary text-xs">
                  Aucun apprenant n'a encore passé cette évaluation.
                </div>
              ) : (
                inspectQuizResults.attempts.map((att) => (
                  <div key={att.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-text-primary">{att.user_email}</p>
                      <span className="text-[10px] text-text-secondary uppercase">
                        Rôle : {att.user_role} • {new Date(att.completed_at).toLocaleDateString()} à {new Date(att.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-sm font-black font-mono block ${
                        att.percentage >= 60 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {att.score} / {att.max_score} ({att.percentage}%)
                      </span>
                      <span className="text-[10px] font-bold text-text-secondary">
                        {att.percentage >= 60 ? 'Validé ✓' : 'Non validé ✗'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setInspectQuizResults(null)}
              className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs font-semibold text-text-primary hover:bg-surface-hover"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : CRÉER UN QUIZ AVEC QUESTIONS (Formateur / Admin)                 */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card max-w-3xl w-full p-6 sm:p-8 rounded-3xl border border-primary/30 space-y-6 my-auto max-h-[90vh] flex flex-col animate-fade-in-up">
            
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <HelpCircle size={20} />
                <h3>Créer & Générer une Évaluation (Quiz)</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-text-secondary hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuizSubmit} className="space-y-5 text-xs">
              {/* Titre */}
              <div>
                <label className="block uppercase font-bold text-text-secondary mb-1">
                  Titre du Quiz *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Évaluation Chapitre 3 - Algorithmes & Bases de Données"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block uppercase font-bold text-text-secondary mb-1">
                  Instructions / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Consignes particulières pour les étudiants, stagiaires ou employés..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary resize-none"
                />
              </div>

              {/* Paramètres : Durée & Public */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase font-bold text-text-secondary mb-1">
                    Limite de Temps (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    required
                    value={newTimeLimit}
                    onChange={(e) => setNewTimeLimit(parseInt(e.target.value) || 15)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-text-secondary mb-1">
                    Public Concerné *
                  </label>
                  <select
                    value={newRoles}
                    onChange={(e) => setNewRoles(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary cursor-pointer"
                  >
                    <option value="étudiant,stagiaire,employer">Tous (Étudiants, Stagiaires, Employés)</option>
                    <option value="étudiant">Étudiants uniquement</option>
                    <option value="stagiaire">Stagiaires uniquement</option>
                    <option value="employer">Employés uniquement</option>
                  </select>
                </div>
              </div>

              {/* Questions Builder */}
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-extrabold text-primary">
                    Questions du Quiz ({newQuestions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddQuestionToBuilder}
                    className="px-3 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus size={14} /> Ajouter une question
                  </button>
                </div>

                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                  {newQuestions.map((q, qIndex) => (
                    <div key={qIndex} className="p-4 rounded-2xl bg-surface border border-border space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary text-xs">Question #{qIndex + 1}</span>
                        {newQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewQuestions(prev => prev.filter((_, idx) => idx !== qIndex))}
                            className="text-text-secondary hover:text-rose-500 transition-colors"
                            title="Supprimer cette question"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        required
                        placeholder="Intitulé de la question..."
                        value={q.question_text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewQuestions(prev => prev.map((item, idx) => idx === qIndex ? { ...item, question_text: val } : item));
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs outline-none focus:border-primary text-text-primary"
                      />

                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-bold text-text-secondary">
                          Options de réponse (Cochez la bonne réponse) :
                        </span>
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${qIndex}`}
                              checked={q.correct_option_index === optIndex}
                              onChange={() => {
                                setNewQuestions(prev => prev.map((item, idx) => idx === qIndex ? { ...item, correct_option_index: optIndex } : item));
                              }}
                              className="cursor-pointer accent-primary"
                            />
                            <input
                              type="text"
                              required
                              placeholder={`Option ${optIndex + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewQuestions(prev => prev.map((item, idx) => {
                                  if (idx !== qIndex) return item;
                                  const updatedOpts = [...item.options];
                                  updatedOpts[optIndex] = val;
                                  return { ...item, options: updatedOpts };
                                }));
                              }}
                              className="flex-1 px-3 py-1.5 rounded-xl bg-background border border-border text-xs outline-none focus:border-primary text-text-primary"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 py-2.5 bg-surface hover:bg-surface-hover rounded-xl font-semibold border border-border text-text-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingQuiz}
                  className="w-1/2 btn-primary py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
                >
                  {isCreatingQuiz ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  <span>Publier l'Évaluation</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
