'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Settings, 
  Camera, 
  Users, 
  BookOpen, 
  Trash2, 
  Plus, 
  Pencil,
  Sparkles, 
  ExternalLink, 
  Database, 
  Code, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  UserPlus,
  Key,
  Search,
  Lock,
  Award,
  Clock,
  BarChart3,
  HelpCircle,
  FileQuestion,
  Check,
  ShieldCheck,
  Server,
  Layers,
  Terminal,
  FileText,
  Globe,
  Cpu,
  HardDrive,
  Video,
  Calendar,
  ClipboardCheck,
  MessageSquare,
  Folder,
  MapPin,
  Briefcase,
  GraduationCap,
  Unlock,
  CreditCard,
  Phone
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import BackButton from '@/components/BackButton';
import RoleSettings from '@/components/profile/RoleSettings';
import PasswordChange from '@/components/profile/PasswordChange';
import {
  COUNTRIES_AND_CITIES,
  SPECIALIZATIONS,
  DEPARTMENTS,
  calculateAge,
  generateUsername
} from '@/lib/profileData';

interface UserProfile {
  id: number;
  email: string;
  role: string;
  avatar_url?: string;
  username?: string;
  nom?: string;
  prenom?: string;
  departement?: string;
  specialisation?: string;
  date_naissance?: string;
  cin?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
}

interface CourseItem {
  id: number;
  title: string;
  description: string;
  cover_image_url?: string;
  instructor_id: number;
  instructor?: { email: string };
}

interface QuizItem {
  id: number;
  title: string;
  description?: string;
  creator_email?: string;
  target_roles: string;
  time_limit_minutes: number;
  question_count: number;
  total_points: number;
  created_at: string;
}

interface QuizAttemptItem {
  id: number;
  quiz_id: number;
  user_email: string;
  user_role: string;
  score: number;
  max_score: number;
  percentage: number;
  completed_at: string;
}

const ALL_ROLES = [
  'étudiant',
  'formateur',
  'stagiaire',
  'employer',
  'pedagogique',
  'admin_manager',
  'admin_limited',
  'admin'
];

const NON_ADMIN_ROLES = [
  'étudiant',
  'formateur',
  'stagiaire',
  'employer',
  'pedagogique'
];

const ADMIN_ROLES = ['admin', 'admin_manager', 'admin_limited'];
const SUPER_ADMIN_ROLES = ['admin', 'admin_limited'];

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
  const backendBaseUrl = rawApiUrl.replace(/\/api\/v1\/?$/, '');

  // Admin & Formateur state
  const [adminTab, setAdminTab] = useState<'users' | 'courses' | 'quizzes' | 'system'>('users');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allCourses, setAllCourses] = useState<CourseItem[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<QuizItem[]>([]);
  const [quizSearchQuery, setQuizSearchQuery] = useState('');
  
  // Quiz Creation Modal in Profile
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDesc, setNewQuizDesc] = useState('');
  const [newQuizTime, setNewQuizTime] = useState(15);
  const [newQuizRoles, setNewQuizRoles] = useState('étudiant,stagiaire,employer');
  const [newQuizQuestions, setNewQuizQuestions] = useState<Array<{
    question_text: string;
    options: string[];
    correct_option_index: number;
    points: number;
  }>>([
    { question_text: '', options: ['', '', '', ''], correct_option_index: 0, points: 5 }
  ]);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);

  // Inspect quiz results modal
  const [inspectQuiz, setInspectQuiz] = useState<{ quiz: QuizItem; attempts: QuizAttemptItem[] } | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User Management Modals & Filters
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountRole, setNewAccountRole] = useState('étudiant');
  const [newAccountNom, setNewAccountNom] = useState('');
  const [newAccountPrenom, setNewAccountPrenom] = useState('');
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [isManualAdminUsername, setIsManualAdminUsername] = useState(false);
  const [newAccountDateNaissance, setNewAccountDateNaissance] = useState('');
  const [newAccountCin, setNewAccountCin] = useState('');
  const [newAccountTelephone, setNewAccountTelephone] = useState('');
  const [newAccountAdresse, setNewAccountAdresse] = useState('');
  const [newAccountPays, setNewAccountPays] = useState('Maroc');
  const [newAccountVille, setNewAccountVille] = useState('Casablanca');
  const [newAccountDepartement, setNewAccountDepartement] = useState(DEPARTMENTS[0]);
  const [newAccountSpecialisation, setNewAccountSpecialisation] = useState(SPECIALIZATIONS[0]);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createAccountError, setCreateAccountError] = useState('');

  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');

  // Edit User modal state
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNom, setEditNom] = useState('');
  const [editPrenom, setEditPrenom] = useState('');
  const [editRole, setEditRole] = useState('étudiant');
  const [editTelephone, setEditTelephone] = useState('');
  const [editCin, setEditCin] = useState('');
  const [editDateNaissance, setEditDateNaissance] = useState('');
  const [editAdresse, setEditAdresse] = useState('');
  const [editVille, setEditVille] = useState('');
  const [editPays, setEditPays] = useState('');
  const [editDepartement, setEditDepartement] = useState('');
  const [editSpecialisation, setEditSpecialisation] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editUserError, setEditUserError] = useState('');

  const handleOpenEditUserModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditUsername(u.username || '');
    setEditEmail(u.email || '');
    setEditNom(u.nom || '');
    setEditPrenom(u.prenom || '');
    setEditRole(u.role || 'étudiant');
    setEditTelephone(u.telephone || '');
    setEditCin(u.cin || '');
    setEditDateNaissance(u.date_naissance || '');
    setEditAdresse(u.adresse || '');
    setEditVille(u.ville || '');
    setEditPays(u.pays || 'Tunisie');
    setEditDepartement(u.departement || '');
    setEditSpecialisation(u.specialisation || '');
    setEditPassword('');
    setEditUserError('');
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdatingUser(true);
    setEditUserError('');
    try {
      const res = await apiClient.put(`/users/${editingUser.id}`, {
        username: editUsername.trim() || undefined,
        email: editEmail.trim() || undefined,
        role: editRole,
        nom: editNom.trim() || undefined,
        prenom: editPrenom.trim() || undefined,
        date_naissance: editDateNaissance || undefined,
        cin: editCin.trim() || undefined,
        telephone: editTelephone.trim() || undefined,
        adresse: editAdresse.trim() || undefined,
        ville: editVille || undefined,
        pays: editPays || undefined,
        departement: editDepartement || undefined,
        specialisation: editSpecialisation || undefined,
        password: editPassword.trim() || undefined,
      });

      setAllUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data : u)));
      setIsEditUserModalOpen(false);
      setEditingUser(null);
      setActionMessage({ type: 'success', text: `Compte utilisateur "${res.data.username || res.data.email}" modifié avec succès.` });
    } catch (err: any) {
      setEditUserError(err?.response?.data?.detail || "Erreur lors de la modification de l'utilisateur.");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleAdminNomChange = (val: string) => {
    setNewAccountNom(val);
    if (!isManualAdminUsername) {
      setNewAccountUsername(generateUsername(val, newAccountPrenom));
    }
  };

  const handleAdminPrenomChange = (val: string) => {
    setNewAccountPrenom(val);
    if (!isManualAdminUsername) {
      setNewAccountUsername(generateUsername(newAccountNom, val));
    }
  };

  const handleAdminCountryChange = (selectedCountry: string) => {
    setNewAccountPays(selectedCountry);
    const cities = COUNTRIES_AND_CITIES[selectedCountry] || ['Autre ville'];
    setNewAccountVille(cities[0] || '');
  };

  const adminAvailableCities = useMemo(() => {
    return COUNTRIES_AND_CITIES[newAccountPays] || ['Autre ville'];
  }, [newAccountPays]);

  const adminCalculatedAge = useMemo(() => {
    return calculateAge(newAccountDateNaissance);
  }, [newAccountDateNaissance]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAccountError('');

    const isAdminTarget = ADMIN_ROLES.includes(newAccountRole);

    if (isAdminTarget) {
      // Admin Exemption: Lightweight Profile
      const adminLogin = (newAccountUsername.trim() || newAccountEmail.trim()).toLowerCase();
      if (!adminLogin || !newAccountPassword.trim()) {
        setCreateAccountError("Veuillez renseigner un nom d'utilisateur (ou email) et un mot de passe.");
        return;
      }
      setIsCreatingAccount(true);
      try {
        const res = await apiClient.post('/users/admin-create', {
          username: adminLogin,
          email: newAccountEmail.trim() || undefined,
          password: newAccountPassword.trim(),
          role: newAccountRole
        });
        setAllUsers(prev => [res.data, ...prev]);
        setIsCreateUserModalOpen(false);
        // Reset states
        setNewAccountEmail('');
        setNewAccountPassword('');
        setNewAccountUsername('');
        setNewAccountRole('étudiant');
        setActionMessage({ type: 'success', text: `Compte administrateur "${res.data.username || res.data.email}" créé avec succès en tant que ${res.data.role}.` });
      } catch (err: any) {
        setCreateAccountError(err?.response?.data?.detail || "Erreur lors de la création de l'administrateur.");
      } finally {
        setIsCreatingAccount(false);
      }
      return;
    }

    // Standard Profile (Étudiant, Stagiaire, Employé, Formateur)
    if (!newAccountNom.trim() || !newAccountPrenom.trim()) {
      setCreateAccountError('Le nom et le prénom sont obligatoires pour un profil standard.');
      return;
    }

    const finalUsername = (newAccountUsername.trim() || generateUsername(newAccountNom, newAccountPrenom)).toLowerCase();
    if (!finalUsername) {
      setCreateAccountError("Le nom d'utilisateur est obligatoire.");
      return;
    }

    if (!newAccountDateNaissance) {
      setCreateAccountError('La date de naissance est obligatoire.');
      return;
    }

    if (!newAccountPays || !newAccountVille) {
      setCreateAccountError('Le pays et la ville sont obligatoires.');
      return;
    }

    if ((newAccountRole === 'employer' || newAccountRole === 'stagiaire') && !newAccountDepartement) {
      setCreateAccountError('Veuillez sélectionner un département professionnel.');
      return;
    }

    if ((newAccountRole === 'étudiant' || newAccountRole === 'stagiaire') && !newAccountSpecialisation) {
      setCreateAccountError('Veuillez sélectionner une spécialisation académique.');
      return;
    }

    if (!newAccountPassword.trim()) {
      setCreateAccountError('Le mot de passe est obligatoire.');
      return;
    }

    setIsCreatingAccount(true);
    try {
      const res = await apiClient.post('/users/admin-create', {
        username: finalUsername,
        nom: newAccountNom.trim(),
        prenom: newAccountPrenom.trim(),
        date_naissance: newAccountDateNaissance,
        email: newAccountEmail.trim() || undefined,
        telephone: newAccountTelephone.trim() || undefined,
        cin: newAccountCin.trim() || undefined,
        adresse: newAccountAdresse.trim() || undefined,
        pays: newAccountPays,
        ville: newAccountVille,
        departement: (newAccountRole === 'employer' || newAccountRole === 'stagiaire') ? newAccountDepartement : undefined,
        specialisation: (newAccountRole === 'étudiant' || newAccountRole === 'stagiaire') ? newAccountSpecialisation : undefined,
        password: newAccountPassword.trim(),
        role: newAccountRole
      });
      setAllUsers(prev => [res.data, ...prev]);
      setIsCreateUserModalOpen(false);
      // Reset form
      setNewAccountEmail('');
      setNewAccountPassword('');
      setNewAccountNom('');
      setNewAccountPrenom('');
      setNewAccountUsername('');
      setNewAccountDateNaissance('');
      setNewAccountCin('');
      setNewAccountTelephone('');
      setNewAccountAdresse('');
      setNewAccountRole('étudiant');
      setActionMessage({ type: 'success', text: `Compte utilisateur "${res.data.username || res.data.email}" créé avec succès en tant que ${res.data.role}.` });
    } catch (err: any) {
      setCreateAccountError(err?.response?.data?.detail || "Erreur lors de la création de l'utilisateur.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newResetPassword.trim()) return;

    setIsResettingPassword(true);
    setResetPasswordError('');
    try {
      await apiClient.put(`/users/${resetPasswordUser.id}/password`, {
        new_password: newResetPassword.trim()
      });
      setResetPasswordUser(null);
      setNewResetPassword('');
      setActionMessage({ type: 'success', text: `Mot de passe mis à jour avec succès pour "${resetPasswordUser.email}".` });
    } catch (err: any) {
      setResetPasswordError(err?.response?.data?.detail || "Échec de la réinitialisation du mot de passe.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setActionMessage({ type: 'error', text: 'Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP).' });
      return;
    }

    setAvatarLoading(true);
    setActionMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser(res.data);
      setActionMessage({ type: 'success', text: 'Photo de profil mise à jour avec succès !' });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error('Avatar upload failed', err);
      setActionMessage({ 
        type: 'error', 
        text: err?.response?.data?.detail || "Échec de l'enregistrement de l'image de profil." 
      });
    } finally {
      setAvatarLoading(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        const res = await apiClient.get('/users/me');
        setUser(res.data);
        if (ADMIN_ROLES.includes(res.data.role) || res.data.role === 'formateur') {
          fetchAdminData(res.data.role);
        }
      } catch (error) {
        console.error('Failed to fetch user', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  const fetchAdminData = async (role?: string) => {
    setAdminLoading(true);
    try {
      const currentRole = role || user?.role;
      const isAdm = ADMIN_ROLES.includes(currentRole || '');
      
      const promises: Promise<any>[] = [
        apiClient.get('/courses/').catch(() => ({ data: [] })),
        apiClient.get('/quizzes/').catch(() => ({ data: [] }))
      ];
      if (isAdm) {
        promises.unshift(apiClient.get('/users/').catch(() => ({ data: [] })));
      }

      const results = await Promise.all(promises);
      if (isAdm) {
        setAllUsers(results[0].data);
        setAllCourses(results[1].data);
        setAllQuizzes(results[2].data);
      } else {
        setAllCourses(results[0].data);
        setAllQuizzes(results[1].data);
        setAdminTab('quizzes');
      }
    } catch (err) {
      console.error('Failed to load management data:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleDeleteQuizInProfile = async (quizId: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce quiz ?')) return;
    try {
      await apiClient.delete(`/quizzes/${quizId}`);
      setAllQuizzes(prev => prev.filter(q => q.id !== quizId));
      setActionMessage({ type: 'success', text: 'Quiz supprimé avec succès.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de la suppression.' });
    }
  };

  const handleInspectQuizInProfile = async (quiz: QuizItem) => {
    setIsLoadingResults(true);
    try {
      const res = await apiClient.get(`/quizzes/${quiz.id}/results`);
      setInspectQuiz({ quiz, attempts: res.data });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors du chargement des résultats.' });
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleCreateQuizInProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuizTitle.trim()) return;

    for (let i = 0; i < newQuizQuestions.length; i++) {
      const q = newQuizQuestions[i];
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
      const res = await apiClient.post('/quizzes/', {
        title: newQuizTitle.trim(),
        description: newQuizDesc.trim() || undefined,
        time_limit_minutes: newQuizTime,
        target_roles: newQuizRoles,
        questions: newQuizQuestions
      });

      setAllQuizzes(prev => [res.data, ...prev]);
      setShowQuizModal(false);
      setNewQuizTitle('');
      setNewQuizDesc('');
      setNewQuizQuestions([{ question_text: '', options: ['', '', '', ''], correct_option_index: 0, points: 5 }]);
      setActionMessage({ type: 'success', text: `Quiz "${res.data.title}" créé et lancé pour les apprenants avec succès !` });
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la création du quiz.');
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  const handleRoleChange = async (targetUserId: number, newRole: string) => {
    setActionMessage(null);
    try {
      await apiClient.put(`/users/${targetUserId}/role`, { role: newRole });
      setAllUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
      if (user && user.id === targetUserId) {
        setUser(prev => prev ? { ...prev, role: newRole } : null);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth_user_updated'));
        window.dispatchEvent(new Event('storage'));
      }
      setActionMessage({ type: 'success', text: `Rôle mis à jour avec succès en "${newRole}".` });
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      setActionMessage({ type: 'error', text: e.response?.data?.detail || 'Erreur lors du changement de rôle.' });
    }
  };

  const handleDeleteUser = async (targetUserId: number, email: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${email}" ?`)) return;
    setActionMessage(null);
    try {
      await apiClient.delete(`/users/${targetUserId}`);
      setAllUsers(prev => prev.filter(u => u.id !== targetUserId));
      setActionMessage({ type: 'success', text: `Utilisateur "${email}" supprimé.` });
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      setActionMessage({ type: 'error', text: e.response?.data?.detail || 'Impossible de supprimer cet utilisateur.' });
    }
  };

  const handleDeleteCourse = async (courseId: number, title: string) => {
    if (!confirm(`Supprimer définitivement le cours "${title}" ?`)) return;
    setActionMessage(null);
    try {
      await apiClient.delete(`/courses/${courseId}`);
      setAllCourses(prev => prev.filter(c => c.id !== courseId));
      setActionMessage({ type: 'success', text: `Cours "${title}" supprimé avec succès.` });
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      setActionMessage({ type: 'error', text: e.response?.data?.detail || 'Erreur lors de la suppression du cours.' });
    }
  };



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const isSuperAdmin = SUPER_ADMIN_ROLES.includes(user.role);
  const isAdminManager = user.role === 'admin_manager';
  const isAdminUser = ADMIN_ROLES.includes(user.role);
  const isStaffUser = isAdminUser || user.role === 'formateur';

  return (
    <div className="min-h-screen bg-white text-slate-900 p-6 md:p-12 space-y-8 max-w-5xl mx-auto">
      <BackButton label="Retour au tableau de bord" />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Paramètres & Profil</h1>
          <p className="text-slate-500 mt-1">Gérez vos informations personnelles et vos préférences.</p>
        </div>
        {isAdminUser && (
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-[#1877f2] border border-blue-200 text-xs font-bold w-fit">
            <Shield size={16} /> {isSuperAdmin ? 'Mode Super-Administrateur Actif' : isAdminManager ? 'Mode Admin Manager Actif' : 'Mode Administrateur Actif'}
          </span>
        )}
      </div>

      {/* Profil Card (Visible par tous les utilisateurs) */}
      <div className="bg-white p-8 space-y-8 rounded-3xl border border-slate-200 shadow-sm">
        
        {/* Avatar Section */}
        <div className="flex flex-col md:flex-row items-center gap-8 pb-8 border-b border-border">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            className="hidden"
          />

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative group cursor-pointer shrink-0"
            title="Cliquer pour insérer ou modifier votre photo de profil"
          >
            {user.avatar_url ? (
              <Image 
                src={user.avatar_url} 
                alt="Avatar" 
                width={110} 
                height={110} 
                className="rounded-full ring-4 ring-primary/30 object-cover w-[110px] h-[110px]"
                unoptimized
              />
            ) : (
              <div className="w-[110px] h-[110px] rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-4xl font-black text-white ring-4 ring-primary/30 shadow-xl select-none">
                {user.email.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Hover overlay with Camera & Spinner */}
            <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold gap-1">
              {avatarLoading ? (
                <Loader2 size={24} className="animate-spin text-primary" />
              ) : (
                <>
                  <Camera size={22} />
                  <span>Changer</span>
                </>
              )}
            </div>
          </div>

          <div className="text-center md:text-left space-y-2">
            <h2 className="text-2xl font-bold">{user.email.split('@')[0]}</h2>
            <div className="flex items-center justify-center md:justify-start gap-2 text-text-secondary">
              <Shield size={16} className="text-primary" />
              <span className="capitalize font-semibold text-primary">{user.role}</span>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border text-xs font-semibold transition-colors"
            >
              {avatarLoading ? (
                <><Loader2 size={14} className="animate-spin" /> Envoi de l'image...</>
              ) : (
                <><Camera size={14} className="text-primary" /> Insérer / Modifier photo</>
              )}
            </button>
          </div>
        </div>


        {/* Details Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface/50 p-4 rounded-xl border border-border">
            <label className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1 block">
              Adresse Email
            </label>
            <div className="flex items-center gap-2 font-medium">
              <Mail size={16} className="text-primary" />
              {user.email}
            </div>
          </div>
          
          <div className="bg-surface/50 p-4 rounded-xl border border-border">
            <label className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1 block">
              Rôle sur la plateforme
            </label>
            <div className="flex items-center gap-2 capitalize font-medium">
              <Shield size={16} className="text-primary" />
              {user.role}
            </div>
          </div>
        </div>

      </div>

      {/* SECTION PARAMÈTRES PAR RÔLE */}
      <RoleSettings role={user.role} />

      {/* SECTION SÉCURITÉ MOT DE PASSE */}
      <PasswordChange />

      {/* ========================================================================= */}
      {/* SECTION OUTILS ADMINISTRATEUR & FORMATEUR (GESTION PLATEFORME)             */}
      {/* ========================================================================= */}
      {isStaffUser && (
        <div className="bg-white p-8 space-y-8 border border-slate-200 shadow-sm rounded-3xl">
          
          {/* Header Outils Admin / Formateur */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1877f2] flex items-center justify-center">
                  <Shield size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {isAdminUser ? 'Outils Administrateur' : 'Espace Formateur & Évaluations'}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {isAdminUser
                      ? "Espace réservé à l'administration pour piloter les utilisateurs, cours et évaluations."
                      : "Espace exclusif réservé aux formateurs pour gérer les cours et les quiz."}
                  </p>
                </div>
              </div>
            </div>

            {/* Onglets de navigation */}
            <div className="flex items-center bg-surface p-1 rounded-xl border border-border flex-wrap gap-1">
              {isAdminUser && (
                <button
                  onClick={() => setAdminTab('users')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    adminTab === 'users' ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Users size={16} /> Utilisateurs ({allUsers.length})
                </button>
              )}
              <button
                onClick={() => setAdminTab('courses')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  adminTab === 'courses' ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <BookOpen size={16} /> Cours ({allCourses.length})
              </button>
              <button
                onClick={() => setAdminTab('quizzes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  adminTab === 'quizzes' ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Award size={16} /> Quiz ({allQuizzes.length})
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setAdminTab('system')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    adminTab === 'system' ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Database size={16} /> Base de Données & Backend (Admin)
                </button>
              )}
            </div>
          </div>

          {/* Feedback messages */}
          {actionMessage && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
              actionMessage.type === 'success' 
                ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* TAB 1 : GESTION DES UTILISATEURS ET DES RÔLES */}
          {isAdminUser && adminTab === 'users' && (
            <div className="space-y-6">
              
              {/* Stat counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <p className="text-xs text-text-secondary font-semibold uppercase">Total Comptes</p>
                  <p className="text-2xl font-black mt-1 text-primary">{allUsers.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <p className="text-xs text-text-secondary font-semibold uppercase">Étudiants & Stagiaires</p>
                  <p className="text-2xl font-black mt-1 text-text-primary">
                    {allUsers.filter(u => ['étudiant', 'stagiaire', 'employer'].includes(u.role)).length}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <p className="text-xs text-text-secondary font-semibold uppercase">Formateurs</p>
                  <p className="text-2xl font-black mt-1 text-cyan-400">
                    {allUsers.filter(u => ['formateur', 'pedagogique'].includes(u.role)).length}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <p className="text-xs text-text-secondary font-semibold uppercase">Administrateurs</p>
                  <p className="text-2xl font-black mt-1 text-purple-400">
                    {allUsers.filter(u => ADMIN_ROLES.includes(u.role)).length}
                  </p>
                </div>
              </div>

              {/* Action bar (Search + Create button) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Filtrer par email ou rôle..."
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-xs outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => fetchAdminData()}
                    disabled={adminLoading}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-surface border border-border hover:bg-surface-hover transition-colors"
                  >
                    {adminLoading ? '...' : 'Actualiser'}
                  </button>
                  <button
                    onClick={() => {
                      setCreateAccountError('');
                      setIsCreateUserModalOpen(true);
                    }}
                    className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow"
                  >
                    <UserPlus size={16} /> Créer un compte
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-text-secondary text-[11px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Utilisateur</th>
                      <th className="px-6 py-4">Rôle Actuel</th>
                      <th className="px-6 py-4">Changer le Rôle</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface/30">
                    {allUsers
                      .filter(u => {
                        if (!userSearchQuery) return true;
                        const q = userSearchQuery.toLowerCase();
                        return u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
                      })
                      .map((u) => {
                        const isCurrentUser = u.id === user.id;
                        const isTargetAdmin = ADMIN_ROLES.includes(u.role);
                        const canModifyTargetRole = isSuperAdmin ? !isCurrentUser : (!isCurrentUser && !isTargetAdmin);
                        const canDeleteTarget = isSuperAdmin ? !isCurrentUser : (!isCurrentUser && !isTargetAdmin);
                        const canResetTargetPassword = isSuperAdmin ? true : !isTargetAdmin;

                        const selectableRoles = isSuperAdmin
                          ? ALL_ROLES
                          : (isTargetAdmin ? [u.role] : NON_ADMIN_ROLES);

                        return (
                          <tr key={u.id} className="hover:bg-surface/60 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                                {u.email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-text-primary">{u.email}</p>
                                <p className="text-[11px] text-text-secondary">ID #{u.id} {isCurrentUser && '(Votre compte)'}</p>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                ADMIN_ROLES.includes(u.role)
                                  ? 'bg-primary/20 text-primary border border-primary/30' 
                                  : u.role === 'formateur' || u.role === 'pedagogique'
                                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-surface text-text-secondary border border-border'
                              }`}>
                                {u.role}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <select
                                value={u.role}
                                disabled={!canModifyTargetRole}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {selectableRoles.map((roleOpt) => (
                                  <option key={roleOpt} value={roleOpt} className="bg-background">
                                    {roleOpt.charAt(0).toUpperCase() + roleOpt.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditUserModal(u)}
                                  className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Modifier les informations de cet utilisateur"
                                >
                                  <Pencil size={16} />
                                </button>
                                {canResetTargetPassword && (
                                  <button
                                    onClick={() => {
                                      setResetPasswordUser(u);
                                      setNewResetPassword('');
                                      setResetPasswordError('');
                                    }}
                                    className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                                    title="Modifier le mot de passe"
                                  >
                                    <Key size={16} />
                                  </button>
                                )}
                                {canDeleteTarget && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                    className="p-2 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Supprimer cet utilisateur"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2 : GESTION DES COURS */}
          {adminTab === 'courses' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">Gestion Globale des Cours</h3>
                  <p className="text-xs text-text-secondary">Ajoutez, testez ou supprimez des cours sur l'ensemble de la plateforme.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <Link
                    href="/courses/new"
                    className="btn-primary px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
                  >
                    <Plus size={16} /> Ajouter un cours
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allCourses.length === 0 ? (
                  <p className="col-span-2 text-center py-12 text-text-secondary">Aucun cours trouvé dans la plateforme.</p>
                ) : (
                  allCourses.map((course) => (
                    <div key={course.id} className="p-5 rounded-2xl bg-surface/50 border border-border flex flex-col justify-between space-y-4 hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                            ID #{course.id}
                          </span>
                          <h4 className="font-bold text-base line-clamp-1">{course.title}</h4>
                          <p className="text-xs text-text-secondary line-clamp-2">{course.description || "Aucune description."}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
                        <span className="text-text-secondary">
                          Par : <span className="font-semibold text-text-primary">{course.instructor?.email || `Formateur #${course.instructor_id}`}</span>
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/courses/${course.id}`}
                            className="px-3 py-1 bg-surface rounded-lg hover:bg-primary/20 hover:text-primary transition-colors flex items-center gap-1 font-medium"
                          >
                            Voir <ExternalLink size={12} />
                          </Link>
                          <button
                            onClick={() => handleDeleteCourse(course.id, course.title)}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Supprimer ce cours"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3 : GESTION DES QUIZ & ÉVALUATIONS */}
          {adminTab === 'quizzes' && (
            <div className="space-y-6">
              {/* Stat counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <p className="text-xs text-text-secondary font-semibold uppercase">Total Quiz</p>
                  <p className="text-2xl font-black mt-1 text-primary">{allQuizzes.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <p className="text-xs text-text-secondary font-semibold uppercase">Questions Totales</p>
                  <p className="text-2xl font-black mt-1 text-text-primary">
                    {allQuizzes.reduce((acc, q) => acc + (q.question_count || 0), 0)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <p className="text-xs text-text-secondary font-semibold uppercase">Points Cumulés</p>
                  <p className="text-2xl font-black mt-1 text-primary">
                    {allQuizzes.reduce((acc, q) => acc + (q.total_points || 0), 0)} pts
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-surface/50 border border-border">
                  <p className="text-xs text-text-secondary font-semibold uppercase">Autorisation</p>
                  <p className="text-xs font-bold mt-2 text-emerald-500 flex items-center gap-1">
                    <ShieldCheck size={14} /> Formateur & Admin
                  </p>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={quizSearchQuery}
                    onChange={(e) => setQuizSearchQuery(e.target.value)}
                    placeholder="Filtrer par titre de quiz..."
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-xs outline-none focus:border-primary text-text-primary"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/quizzes"
                    className="px-4 py-2.5 bg-surface hover:bg-surface-hover border border-border text-text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>🚀 Lancer / Voir Quiz</span>
                    <ExternalLink size={14} />
                  </Link>

                  <button
                    onClick={() => setShowQuizModal(true)}
                    className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/20"
                  >
                    <Plus size={16} /> Créer & Lancer un Quiz
                  </button>
                </div>
              </div>

              {/* Quizzes Table / List */}
              <div className="glass-card rounded-2xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  {allQuizzes
                    .filter(q => !quizSearchQuery || q.title.toLowerCase().includes(quizSearchQuery.toLowerCase()))
                    .length === 0 ? (
                    <div className="p-8 text-center text-text-secondary text-xs">
                      Aucun quiz trouvé. Cliquez sur "Créer & Lancer un Quiz" pour publier une première évaluation.
                    </div>
                  ) : (
                    allQuizzes
                      .filter(q => !quizSearchQuery || q.title.toLowerCase().includes(quizSearchQuery.toLowerCase()))
                      .map((quiz) => (
                        <div key={quiz.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface/50 transition-colors">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <h4 className="text-sm font-bold text-text-primary">{quiz.title}</h4>
                            </div>
                            <p className="text-xs text-text-secondary line-clamp-1 max-w-xl">
                              {quiz.description || "Évaluation des connaissances académiques et professionnelles."}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-text-secondary">
                              <span className="flex items-center gap-1">
                                <FileQuestion size={13} className="text-primary" /> {quiz.question_count} questions ({quiz.total_points} pts)
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock size={13} className="text-primary" /> {quiz.time_limit_minutes} min
                              </span>
                              <span>•</span>
                              <span className="text-[11px] font-medium text-text-secondary">
                                Public : <span className="capitalize">{quiz.target_roles.split(',').join(', ')}</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              href="/quizzes"
                              className="px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <span>🚀 Lancer</span>
                            </Link>
                            <button
                              onClick={() => handleInspectQuizInProfile(quiz)}
                              className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <BarChart3 size={14} className="text-primary" />
                              <span>Résultats</span>
                            </button>
                            <button
                              onClick={() => handleDeleteQuizInProfile(quiz.id)}
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
            </div>
          )}

          {/* TAB 4 : OUTILS SYSTÈME, LIENS BACKEND & BASE DE DONNÉES (ADMIN SUPER SEULEMENT) */}
          {isSuperAdmin && adminTab === 'system' && (
            <div className="space-y-8 animate-fade-in-up">
              
              {/* Security Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-blue-900/20 to-surface/40 border border-primary/40 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/20">
                      <ShieldCheck size={26} />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-text-primary flex items-center gap-2">
                        Portail Backend & Base de Données
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary text-white">
                          Admin Only
                        </span>
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Tous les liens d'accès direct au backend FastAPI et aux tables de la base de données SQLite.
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                    <Lock size={14} /> Accès strictement réservé à l'administrateur
                  </div>
                </div>

                {/* Infrastructure Status Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/50">
                  <div className="p-3 rounded-xl bg-background/60 border border-border flex items-center gap-3">
                    <Server size={18} className="text-primary" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-secondary">Serveur API</div>
                      <div className="text-xs font-mono font-bold text-text-primary">Port 8000 (FastAPI)</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-background/60 border border-border flex items-center gap-3">
                    <Database size={18} className="text-accent-blue" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-secondary">Base de Données</div>
                      <div className="text-xs font-mono font-bold text-text-primary">SQLite (eschola.db)</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-background/60 border border-border flex items-center gap-3">
                    <Layers size={18} className="text-accent-green" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-secondary">Tables ORM</div>
                      <div className="text-xs font-mono font-bold text-text-primary">14 Tables Actives</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-background/60 border border-border flex items-center gap-3">
                    <Key size={18} className="text-accent-amber" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-secondary">Sécurité Auth</div>
                      <div className="text-xs font-mono font-bold text-text-primary">JWT Bearer (7j)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. OUTILS D'ADMINISTRATION & DOCUMENTATION PRINCIPAUX */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Terminal size={18} className="text-primary" />
                  <h4 className="text-base font-bold text-text-primary">Outils Développeur & Interfaces Backend</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Panneau SQLAdmin Général */}
                  <a
                    href={`${backendBaseUrl}/admin`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-surface/50 border border-border hover:border-primary transition-all group flex flex-col justify-between hover:shadow-lg hover:shadow-primary/10"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Database size={20} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-primary/20 text-primary">Tableau BDD</span>
                      </div>
                      <h5 className="font-bold text-base text-text-primary group-hover:text-primary transition-colors">Panneau SQLAdmin</h5>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Interface d'administration complète pour explorer, insérer, modifier et exporter toutes les tables SQLite.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-primary">
                      <span>{backendBaseUrl}/admin</span>
                      <ExternalLink size={14} />
                    </div>
                  </a>

                  {/* Swagger UI */}
                  <a
                    href={`${backendBaseUrl}/docs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-surface/50 border border-border hover:border-accent-blue transition-all group flex flex-col justify-between hover:shadow-lg hover:shadow-accent-blue/10"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Code size={20} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-accent-blue/20 text-accent-blue">Swagger UI</span>
                      </div>
                      <h5 className="font-bold text-base text-text-primary group-hover:text-accent-blue transition-colors">Documentation Swagger</h5>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Console interactive OpenAPI pour tester directement les requêtes HTTP (GET, POST, PUT, DELETE) avec jeton JWT.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-accent-blue">
                      <span>{backendBaseUrl}/docs</span>
                      <ExternalLink size={14} />
                    </div>
                  </a>

                  {/* ReDoc */}
                  <a
                    href={`${backendBaseUrl}/redoc`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-surface/50 border border-border hover:border-purple-500 transition-all group flex flex-col justify-between hover:shadow-lg hover:shadow-purple-500/10"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileText size={20} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">OpenAPI Spec</span>
                      </div>
                      <h5 className="font-bold text-base text-text-primary group-hover:text-purple-400 transition-colors">Spécification ReDoc</h5>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Documentation de référence structurée avec schémas de validation Pydantic et modèles de données.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-purple-400">
                      <span>{backendBaseUrl}/redoc</span>
                      <ExternalLink size={14} />
                    </div>
                  </a>

                  {/* OpenAPI JSON Raw */}
                  <a
                    href={`${backendBaseUrl}/api/v1/openapi.json`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-surface/50 border border-border hover:border-amber-500 transition-all group flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Globe size={20} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">JSON Schema</span>
                      </div>
                      <h5 className="font-bold text-base text-text-primary group-hover:text-amber-400 transition-colors">Schéma OpenAPI JSON</h5>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Fichier JSON brut décrivant l'ensemble de l'API pour l'import dans Postman, Insomnia ou curl.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-amber-400">
                      <span>/api/v1/openapi.json</span>
                      <ExternalLink size={14} />
                    </div>
                  </a>

                  {/* Racine API Backend */}
                  <a
                    href={`${backendBaseUrl}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-surface/50 border border-border hover:border-emerald-500 transition-all group flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Cpu size={20} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Health Check</span>
                      </div>
                      <h5 className="font-bold text-base text-text-primary group-hover:text-emerald-400 transition-colors">Racine Backend API</h5>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Vérification du statut d'exécution du serveur FastAPI et message d'accueil de l'API.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span>{backendBaseUrl}/</span>
                      <ExternalLink size={14} />
                    </div>
                  </a>

                  {/* Dossier Uploads & Fichiers Statiques */}
                  <a
                    href={`${backendBaseUrl}/uploads`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-surface/50 border border-border hover:border-cyan-500 transition-all group flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Folder size={20} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Fichiers Statiques</span>
                      </div>
                      <h5 className="font-bold text-base text-text-primary group-hover:text-cyan-400 transition-colors">Stockage Fichiers (/uploads)</h5>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Répertoire public servant les livrables étudiants, documents PDF, avatars et vidéos téléversés.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-cyan-400">
                      <span>/uploads</span>
                      <ExternalLink size={14} />
                    </div>
                  </a>
                </div>
              </div>

              {/* 2. LIENS DIRECTS VERS TOUTES LES TABLES DE LA BASE DE DONNÉES */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive size={18} className="text-primary" />
                    <h4 className="text-base font-bold text-text-primary">Tables de la Base de Données (Accès SQLAdmin Direct)</h4>
                  </div>
                  <span className="text-xs font-bold text-text-secondary">14 Tables Enregistrées</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[
                    { title: "Utilisateurs", table: "users", link: `${backendBaseUrl}/admin/user/list`, icon: UserIcon, desc: "Comptes, emails, hashs, rôles" },
                    { title: "Cours", table: "courses", link: `${backendBaseUrl}/admin/course/list`, icon: BookOpen, desc: "Modules, descriptions, documents" },
                    { title: "Vidéos de Cours", table: "course_videos", link: `${backendBaseUrl}/admin/coursevideo/list`, icon: Video, desc: "Vidéos ordonnées par cours" },
                    { title: "Inscriptions", table: "enrollments", link: `${backendBaseUrl}/admin/enrollment/list`, icon: Award, desc: "Liaisons étudiants ↔ cours" },
                    { title: "Calendrier & Planning", table: "events", link: `${backendBaseUrl}/admin/event/list`, icon: Calendar, desc: "Événements, dates début/fin" },
                    { title: "Livrables Événements", table: "event_deliverables", link: `${backendBaseUrl}/admin/eventdeliverable/list`, icon: Folder, desc: "Devoirs, fichiers, liens soumis" },
                    { title: "Quiz & Évaluations", table: "quizzes", link: `${backendBaseUrl}/admin/quiz/list`, icon: FileQuestion, desc: "Titres, timer, rôles cibles" },
                    { title: "Questions Quiz", table: "quiz_questions", link: `${backendBaseUrl}/admin/quizquestion/list`, icon: HelpCircle, desc: "QCM, options JSON, points" },
                    { title: "Tentatives Quiz", table: "quiz_attempts", link: `${backendBaseUrl}/admin/quizattempt/list`, icon: BarChart3, desc: "Scores, pourcentages, réponses" },
                    { title: "Présences", table: "attendance", link: `${backendBaseUrl}/admin/attendance/list`, icon: ClipboardCheck, desc: "Statuts d'émargement & retards" },
                    { title: "Groupes & Classes", table: "groups", link: `${backendBaseUrl}/admin/group/list`, icon: Users, desc: "Classes, niveaux scolaires" },
                    { title: "Membres de Groupes", table: "group_members", link: `${backendBaseUrl}/admin/groupmember/list`, icon: UserPlus, desc: "Affectation utilisateurs ↔ groupes" },
                    { title: "Classes Virtuelles", table: "classrooms", link: `${backendBaseUrl}/admin/classroom/list`, icon: Video, desc: "Salles visioconférence & hôtes" },
                    { title: "Messagerie", table: "messages", link: `${backendBaseUrl}/admin/message/list`, icon: MessageSquare, desc: "Boîtes de réception, signalements" },
                  ].map((tbl, idx) => {
                    const IconComp = tbl.icon;
                    return (
                      <a
                        key={idx}
                        href={tbl.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3.5 rounded-xl bg-surface/30 border border-border hover:border-primary/50 hover:bg-surface transition-all group flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <IconComp size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                              {tbl.title}
                            </div>
                            <div className="text-[10px] font-mono text-text-secondary truncate mt-0.5">
                              {tbl.table}
                            </div>
                            <div className="text-[10px] text-text-secondary/70 truncate mt-0.5">
                              {tbl.desc}
                            </div>
                          </div>
                        </div>
                        <ExternalLink size={12} className="text-text-secondary group-hover:text-primary shrink-0 mt-1" />
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* 3. RÉPERTOIRE DES ENDPOINTS REST DE L'API V1 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Code size={18} className="text-primary" />
                  <h4 className="text-base font-bold text-text-primary">Endpoints REST de l'API (Base : <code>{backendBaseUrl}/api/v1</code>)</h4>
                </div>

                <div className="p-4 rounded-2xl bg-surface/30 border border-border overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-secondary font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 pr-4">Méthode</th>
                        <th className="pb-3 pr-4">Module / Route</th>
                        <th className="pb-3 pr-4">Rôle requis</th>
                        <th className="pb-3 pr-4">Description</th>
                        <th className="pb-3 text-right">Lien direct</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-text-secondary">
                      {[
                        { method: "POST", route: "/login/access-token", role: "Public", desc: "Authentification utilisateur et émission du jeton JWT Bearer" },
                        { method: "GET", route: "/users/me", role: "Authentifié", desc: "Profil complet de l'utilisateur connecté" },
                        { method: "POST", route: "/users/admin-create", role: "Admin", desc: "Création manuelle de compte avec rôle personnalisé" },
                        { method: "GET", route: "/courses/", role: "Authentifié", desc: "Catalogue de tous les cours et modules disponibles" },
                        { method: "POST", route: "/courses/", role: "Formateur/Admin", desc: "Création d'un nouveau cours avec documents et vidéos" },
                        { method: "GET", route: "/events/", role: "Authentifié", desc: "Événements et plannings du calendrier officiel" },
                        { method: "POST", route: "/events/{id}/deliverables", role: "Étudiant", desc: "Dépôt d'un livrable ou lien de projet pour un cours" },
                        { method: "GET", route: "/quizzes/", role: "Authentifié", desc: "Liste des quiz actifs avec chronomètre et classement" },
                        { method: "POST", route: "/quizzes/{id}/submit", role: "Étudiant", desc: "Soumission des réponses QCM et calcul automatique de la note" },
                        { method: "GET", route: "/attendance/records", role: "Authentifié", desc: "Historique d'émargement et feuilles de présence" },
                        { method: "POST", route: "/attendance/mark", role: "Formateur/Admin", desc: "Enregistrement de l'état de présence (Présent, Retard, Absent)" },
                        { method: "GET", route: "/groups/", role: "Authentifié", desc: "Liste de toutes les classes et niveaux d'étude" },
                        { method: "POST", route: "/groups/{id}/members", role: "Formateur/Admin", desc: "Affectation d'un apprenant à une classe spécifique" },
                        { method: "GET", route: "/classrooms/", role: "Authentifié", desc: "Salles de classe virtuelle en direct (visioconférence)" },
                        { method: "GET", route: "/messages/inbox", role: "Authentifié", desc: "Boîte de réception de la messagerie interne" },
                        { method: "POST", route: "/upload/file", role: "Authentifié", desc: "Téléversement de tout type de fichier ou document" },
                      ].map((ep, i) => (
                        <tr key={i} className="hover:bg-surface/50 transition-colors">
                          <td className="py-2.5 pr-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              ep.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              ep.method === 'POST' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              ep.method === 'PUT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {ep.method}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono font-bold text-text-primary text-xs">
                            {ep.route}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface border border-border">
                              {ep.role}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-text-secondary">
                            {ep.desc}
                          </td>
                          <td className="py-2.5 text-right">
                            <a
                              href={`${backendBaseUrl}/docs#${ep.route}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              Tester <ExternalLink size={12} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* MODAL CRÉER UN COMPTE UTILISATEUR */}
          {isCreateUserModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-2xl border border-border space-y-5 animate-fade-in-up">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5 text-primary font-bold text-lg">
                    <UserPlus size={22} />
                    <h3>Créer un Compte Utilisateur</h3>
                  </div>
                  <button 
                    onClick={() => setIsCreateUserModalOpen(false)}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors font-bold text-sm"
                    title="Fermer"
                  >
                    ✕
                  </button>
                </div>

                {createAccountError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} /> {createAccountError}
                  </div>
                )}

                <form onSubmit={handleCreateAccount} className="space-y-5 text-xs">
                  
                  {/* SÉLECTEUR DE RÔLE (Pilote de formulaire) */}
                  <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2">
                    <label className="block text-[11px] font-bold uppercase text-text-secondary">
                      Rôle assigné au compte *
                    </label>
                    <select
                      value={newAccountRole}
                      onChange={(e) => setNewAccountRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none text-xs font-semibold text-text-primary"
                    >
                      {(isSuperAdmin ? ALL_ROLES : NON_ADMIN_ROLES).map((roleOpt) => (
                        <option key={roleOpt} value={roleOpt} className="bg-background">
                          {roleOpt.charAt(0).toUpperCase() + roleOpt.slice(1)}
                        </option>
                      ))}
                    </select>

                    {/* Badge indicatif sur la portée du formulaire */}
                    {ADMIN_ROLES.includes(newAccountRole) ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                        <ShieldCheck size={15} className="shrink-0" />
                        <span><strong>Exemption Administrateur :</strong> Profil allégé (identifiant et mot de passe uniquement).</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px]">
                        <Users size={15} className="shrink-0" />
                        <span><strong>Profil Standard :</strong> Formulaire détaillé avec identité, localisation et affectation.</span>
                      </div>
                    )}
                  </div>

                  {/* CAS 1 : EXEMPTION ADMIN (PROFIL ALLÉGÉ) */}
                  {ADMIN_ROLES.includes(newAccountRole) ? (
                    <div className="space-y-3 p-4 rounded-xl bg-surface/50 border border-border">
                      <div>
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                          Nom d'utilisateur / Identifiant Admin *
                        </label>
                        <input
                          type="text"
                          required
                          value={newAccountUsername}
                          onChange={(e) => setNewAccountUsername(e.target.value)}
                          placeholder="admin.manager ou admin"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none text-xs text-text-primary font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                          Mot de passe *
                        </label>
                        <input
                          type="password"
                          required
                          value={newAccountPassword}
                          onChange={(e) => setNewAccountPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none text-xs text-text-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                          Adresse Email <span className="text-text-secondary/60 font-normal">(Optionnel pour admin)</span>
                        </label>
                        <input
                          type="email"
                          value={newAccountEmail}
                          onChange={(e) => setNewAccountEmail(e.target.value)}
                          placeholder="admin@eschola.pro"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none text-xs text-text-primary"
                        />
                      </div>
                    </div>
                  ) : (
                    /* CAS 2 : PROFIL STANDARD COMPLET */
                    <div className="space-y-4">
                      
                      {/* 1. Identité */}
                      <div className="space-y-3">
                        <div className="text-[10.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border/50">
                          <UserIcon size={13} />
                          <span>1. Identité & État Civil</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Nom *
                            </label>
                            <input
                              type="text"
                              required
                              value={newAccountNom}
                              onChange={(e) => handleAdminNomChange(e.target.value)}
                              placeholder="Ex: Dupont"
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Prénom *
                            </label>
                            <input
                              type="text"
                              required
                              value={newAccountPrenom}
                              onChange={(e) => handleAdminPrenomChange(e.target.value)}
                              placeholder="Ex: Jean"
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary"
                            />
                          </div>
                        </div>

                        {/* Username avec toggle */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-text-secondary">
                              Nom d'utilisateur *
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsManualAdminUsername(!isManualAdminUsername)}
                              className="text-[10px] text-primary hover:underline font-semibold inline-flex items-center gap-1"
                            >
                              <Unlock size={10} />
                              <span>{isManualAdminUsername ? 'Mode auto' : 'Personnaliser'}</span>
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              value={newAccountUsername}
                              onChange={(e) => {
                                setIsManualAdminUsername(true);
                                setNewAccountUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                              }}
                              placeholder="jean.dupont"
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary font-mono"
                            />
                            {!isManualAdminUsername && newAccountUsername && (
                              <span className="absolute right-2.5 top-2 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[9.5px] font-bold">
                                Auto
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Date de naissance */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                              <Calendar size={12} className="text-text-secondary" />
                              <span>Date de naissance *</span>
                            </label>
                            {adminCalculatedAge !== null && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                🎂 {adminCalculatedAge} ans
                              </span>
                            )}
                          </div>
                          <input
                            type="date"
                            required
                            max={new Date().toISOString().split('T')[0]}
                            value={newAccountDateNaissance}
                            onChange={(e) => setNewAccountDateNaissance(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* 2. Localisation & Contact */}
                      <div className="space-y-3 pt-1">
                        <div className="text-[10.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border/50">
                          <MapPin size={13} />
                          <span>2. Localisation & Coordonnées</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Pays *
                            </label>
                            <select
                              value={newAccountPays}
                              onChange={(e) => handleAdminCountryChange(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary cursor-pointer"
                            >
                              {Object.keys(COUNTRIES_AND_CITIES).map((c) => (
                                <option key={c} value={c} className="bg-background">
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Ville *
                            </label>
                            <select
                              value={newAccountVille}
                              onChange={(e) => setNewAccountVille(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary cursor-pointer"
                            >
                              {adminAvailableCities.map((v) => (
                                <option key={v} value={v} className="bg-background">
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Email <span className="text-text-secondary/60 font-normal">(Optionnel)</span>
                            </label>
                            <input
                              type="email"
                              value={newAccountEmail}
                              onChange={(e) => setNewAccountEmail(e.target.value)}
                              placeholder="jean.dupont@exemple.com"
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Téléphone <span className="text-text-secondary/60 font-normal">(Optionnel)</span>
                            </label>
                            <input
                              type="tel"
                              value={newAccountTelephone}
                              onChange={(e) => setNewAccountTelephone(e.target.value)}
                              placeholder="+212 6 00 00 00 00"
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              CIN <span className="text-text-secondary/60 font-normal">(Optionnel)</span>
                            </label>
                            <input
                              type="text"
                              value={newAccountCin}
                              onChange={(e) => setNewAccountCin(e.target.value.toUpperCase())}
                              placeholder="AB123456"
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Adresse <span className="text-text-secondary/60 font-normal">(Optionnel)</span>
                            </label>
                            <input
                              type="text"
                              value={newAccountAdresse}
                              onChange={(e) => setNewAccountAdresse(e.target.value)}
                              placeholder="Quartier, Rue..."
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 3. Affectation Métier & Académique (Conditionnelle) */}
                      <div className="space-y-3 pt-1">
                        <div className="text-[10.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border/50">
                          <Briefcase size={13} />
                          <span>3. Affectation Pédagogique & Professionnelle</span>
                        </div>

                        {/* Spécialisation pour Étudiant et Stagiaire */}
                        {(newAccountRole === 'étudiant' || newAccountRole === 'stagiaire') && (
                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Spécialisation / Filière *
                            </label>
                            <select
                              value={newAccountSpecialisation}
                              onChange={(e) => setNewAccountSpecialisation(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary cursor-pointer"
                            >
                              {SPECIALIZATIONS.map((s) => (
                                <option key={s} value={s} className="bg-background">
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Département pour Employé et Stagiaire */}
                        {(newAccountRole === 'employer' || newAccountRole === 'stagiaire') && (
                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Département Professionnel *
                            </label>
                            <select
                              value={newAccountDepartement}
                              onChange={(e) => setNewAccountDepartement(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary cursor-pointer"
                            >
                              {DEPARTMENTS.map((d) => (
                                <option key={d} value={d} className="bg-background">
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* 4. Mot de passe */}
                      <div className="pt-1">
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                          Mot de passe initial *
                        </label>
                        <input
                          type="password"
                          required
                          value={newAccountPassword}
                          onChange={(e) => setNewAccountPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary"
                        />
                      </div>

                    </div>
                  )}

                  {/* Actions Buttons */}
                  <div className="pt-3 flex gap-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setIsCreateUserModalOpen(false)}
                      className="w-1/2 py-2.5 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold border border-border text-text-primary transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingAccount}
                      className="w-1/2 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isCreatingAccount ? <Loader2 size={15} className="animate-spin" /> : 'Créer le compte'}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}

          {/* MODAL MODIFIER LE MOT DE PASSE */}
          {resetPasswordUser && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-border space-y-6 animate-fade-in-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold text-lg">
                    <Key size={20} />
                    <h3>Modifier le Mot de Passe</h3>
                  </div>
                  <button 
                    onClick={() => setResetPasswordUser(null)}
                    className="text-text-secondary hover:text-text-primary font-bold"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-text-secondary">
                  Compte cible : <span className="font-semibold text-text-primary">{resetPasswordUser.email}</span> (ID #{resetPasswordUser.id})
                </p>

                {resetPasswordError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} /> {resetPasswordError}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-text-secondary mb-1">
                      Nouveau mot de passe *
                    </label>
                    <input
                      type="password"
                      required
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      placeholder="Nouveau mot de passe fort"
                      className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary outline-none text-sm"
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setResetPasswordUser(null)}
                      className="w-1/2 py-3 bg-surface hover:bg-surface-hover rounded-xl text-sm font-semibold border border-border"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isResettingPassword}
                      className="w-1/2 btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                      {isResettingPassword ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL CRÉER ET LANCER UN QUIZ (FORMATEUR / ADMIN) */}
          {showQuizModal && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
              <div className="glass-card max-w-3xl w-full p-6 sm:p-8 rounded-3xl border border-primary/30 space-y-6 my-auto max-h-[90vh] flex flex-col animate-fade-in-up">
                
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2 text-primary font-bold text-base">
                    <Award size={20} />
                    <h3>Créer & Lancer une Évaluation (Quiz)</h3>
                  </div>
                  <button 
                    onClick={() => setShowQuizModal(false)}
                    className="text-text-secondary hover:text-text-primary font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateQuizInProfile} className="space-y-5 text-xs">
                  <div>
                    <label className="block uppercase font-bold text-text-secondary mb-1">
                      Titre du Quiz *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Évaluation Chapitre 3 - Algorithmes & Bases de Données"
                      value={newQuizTitle}
                      onChange={(e) => setNewQuizTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                    />
                  </div>

                  <div>
                    <label className="block uppercase font-bold text-text-secondary mb-1">
                      Instructions / Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Consignes particulières pour les étudiants, stagiaires ou employés..."
                      value={newQuizDesc}
                      onChange={(e) => setNewQuizDesc(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary resize-none"
                    />
                  </div>

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
                        value={newQuizTime}
                        onChange={(e) => setNewQuizTime(parseInt(e.target.value) || 15)}
                        className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">
                        Public Concerné *
                      </label>
                      <select
                        value={newQuizRoles}
                        onChange={(e) => setNewQuizRoles(e.target.value)}
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
                        Questions du Quiz ({newQuizQuestions.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => setNewQuizQuestions(prev => [
                          ...prev,
                          { question_text: '', options: ['', '', '', ''], correct_option_index: 0, points: 5 }
                        ])}
                        className="px-3 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <Plus size={14} /> Ajouter une question
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                      {newQuizQuestions.map((q, qIndex) => (
                        <div key={qIndex} className="p-4 rounded-2xl bg-surface border border-border space-y-3 relative">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-text-primary text-xs">Question #{qIndex + 1}</span>
                            {newQuizQuestions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setNewQuizQuestions(prev => prev.filter((_, idx) => idx !== qIndex))}
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
                              setNewQuizQuestions(prev => prev.map((item, idx) => idx === qIndex ? { ...item, question_text: val } : item));
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
                                  name={`profile_correct_${qIndex}`}
                                  checked={q.correct_option_index === optIndex}
                                  onChange={() => {
                                    setNewQuizQuestions(prev => prev.map((item, idx) => idx === qIndex ? { ...item, correct_option_index: optIndex } : item));
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
                                    setNewQuizQuestions(prev => prev.map((item, idx) => {
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

                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowQuizModal(false)}
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
                      <span>Publier & Lancer le Quiz</span>
                    </button>
                  </div>
                </form>

              </div>
            </div>
          )}

          {/* MODAL CONSULTER LES RÉSULTATS DES ÉTUDIANTS DANS PROFILE */}
          {inspectQuiz && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
              <div className="glass-card max-w-2xl w-full p-6 rounded-3xl border border-primary/30 space-y-4 max-h-[85vh] flex flex-col animate-fade-in-up my-auto">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-primary">RÉSULTATS DE L'ÉVALUATION</span>
                    <h3 className="text-base font-bold text-text-primary">{inspectQuiz.quiz.title}</h3>
                  </div>
                  <button 
                    onClick={() => setInspectQuiz(null)}
                    className="text-text-secondary hover:text-text-primary font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {inspectQuiz.attempts.length === 0 ? (
                    <div className="p-8 text-center text-text-secondary text-xs">
                      Aucun apprenant n'a encore passé cette évaluation.
                    </div>
                  ) : (
                    inspectQuiz.attempts.map((att) => (
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
                  onClick={() => setInspectQuiz(null)}
                  className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs font-semibold text-text-primary hover:bg-surface-hover"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* MODAL ÉDITER UN COMPTE UTILISATEUR (Formateurs / Admin) */}
          {isEditUserModalOpen && editingUser && (
            <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="glass-card max-w-2xl w-full p-6 sm:p-8 rounded-3xl border border-primary/40 space-y-5 my-auto max-h-[90vh] overflow-y-auto animate-fade-in-up">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Pencil size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">Modifier l'utilisateur</h3>
                      <p className="text-xs text-text-secondary">Édition des informations du compte #{editingUser.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsEditUserModalOpen(false); setEditingUser(null); }}
                    className="text-text-secondary hover:text-text-primary font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>

                {editUserError && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" /> {editUserError}
                  </div>
                )}

                <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Rôle *</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary font-semibold"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Nom d'utilisateur</label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Nom</label>
                      <input
                        type="text"
                        value={editNom}
                        onChange={(e) => setEditNom(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Prénom</label>
                      <input
                        type="text"
                        value={editPrenom}
                        onChange={(e) => setEditPrenom(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Adresse Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Téléphone</label>
                      <input
                        type="text"
                        value={editTelephone}
                        onChange={(e) => setEditTelephone(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">CIN / Pièce d'identité</label>
                      <input
                        type="text"
                        value={editCin}
                        onChange={(e) => setEditCin(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Date de naissance</label>
                      <input
                        type="date"
                        value={editDateNaissance}
                        onChange={(e) => setEditDateNaissance(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Pays</label>
                      <input
                        type="text"
                        value={editPays}
                        onChange={(e) => setEditPays(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Ville</label>
                      <input
                        type="text"
                        value={editVille}
                        onChange={(e) => setEditVille(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Département (Employé / Stagiaire)</label>
                      <input
                        type="text"
                        value={editDepartement}
                        onChange={(e) => setEditDepartement(e.target.value)}
                        placeholder="Ex: Informatique, RH..."
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block uppercase font-bold text-text-secondary mb-1">Spécialisation (Étudiant / Stagiaire)</label>
                      <input
                        type="text"
                        value={editSpecialisation}
                        onChange={(e) => setEditSpecialisation(e.target.value)}
                        placeholder="Ex: Génie Logiciel, Data..."
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block uppercase font-bold text-text-secondary mb-1">Nouveau mot de passe (optionnel)</label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Laisser vide pour conserver le mot de passe actuel"
                        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none focus:border-primary font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => { setIsEditUserModalOpen(false); setEditingUser(null); }}
                      className="w-1/2 py-3 bg-surface hover:bg-surface-hover rounded-xl font-semibold border border-border"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingUser}
                      className="w-1/2 btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                      {isUpdatingUser ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      <span>Enregistrer les modifications</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
