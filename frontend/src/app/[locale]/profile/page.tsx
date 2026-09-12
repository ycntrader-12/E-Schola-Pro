'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Link, useRouter } from '@/i18n/routing';
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
  FolderOpen,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  Filter,
  SlidersHorizontal,
  MapPin,
  Briefcase,
  GraduationCap,
  Unlock,
  CreditCard,
  Phone,
  Power,
  UserCheck,
  UserX,
  ShieldAlert,
  Network,
  RefreshCw,
  ChevronRight,
  Copy,
  CheckCheck,
  Info,
  Laptop,
  Building2,
  Hash,
  Activity,
  FolderTree,
  Radio,
  FileCheck,
  UserCog,
  Zap
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import BackButton from '@/components/BackButton';
import RoleSettings from '@/components/profile/RoleSettings';
import PasswordChange from '@/components/profile/PasswordChange';
import { UserProfileCard } from '@/components/profile/UserProfileCard';
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
  is_active?: boolean;
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
  group_name?: string;
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
  'dg_rh',
  'admin_manager',
  'admin'
];

const NON_ADMIN_ROLES = [
  'étudiant',
  'formateur',
  'stagiaire',
  'employer',
  'pedagogique',
  'dg_rh'
];

const ADMIN_ROLES = ['admin', 'admin_manager'];
const SUPER_ADMIN_ROLES = ['admin'];
const PROTECTED_ROOT_USERNAMES = ['admin_first'];
const PROTECTED_ROOT_EMAILS = ['admin_first@eschola.pro'];

const isRootAdmin = (targetUser?: { username?: string; email?: string } | null) => {
  if (!targetUser) return false;
  const uname = (targetUser.username || '').trim().toLowerCase();
  const umail = (targetUser.email || '').trim().toLowerCase();
  return PROTECTED_ROOT_USERNAMES.includes(uname) || PROTECTED_ROOT_EMAILS.includes(umail);
};

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
  const [editGroupName, setEditGroupName] = useState('');
  const [systemGroups, setSystemGroups] = useState<Array<{ id: number; name: string; level?: string }>>([]);
  const [newAccountGroupName, setNewAccountGroupName] = useState('');
  const [editTelephone, setEditTelephone] = useState('');
  const [editCin, setEditCin] = useState('');
  const [editDateNaissance, setEditDateNaissance] = useState('');
  const [editAdresse, setEditAdresse] = useState('');
  const [editVille, setEditVille] = useState('');
  const [editPays, setEditPays] = useState('');
  const [editDepartement, setEditDepartement] = useState('');
  const [editSpecialisation, setEditSpecialisation] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editUserError, setEditUserError] = useState('');

  // 3D Centered Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'status_toggle' | 'bulk_status_toggle' | 'delete_user' | 'delete_course' | 'delete_quiz';
    targetUser?: UserProfile;
    targetId?: number;
    targetTitle?: string;
    targetNewStatus?: boolean;
    isProcessing?: boolean;
  }>({
    isOpen: false,
    type: 'status_toggle',
  });

  // ==========================================
  // ACTIVE DIRECTORY & ENTRA ID WEB CONSOLE STATE
  // ==========================================
  const [selectedDirectoryUserId, setSelectedDirectoryUserId] = useState<number | null>(null);
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [directoryInspectorTab, setDirectoryInspectorTab] = useState<'attributes' | 'groups' | 'security'>('attributes');
  const [isCopiedUpn, setIsCopiedUpn] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [treeExpanded, setTreeExpanded] = useState<{ domain: boolean; ous: boolean; groups: boolean }>({
    domain: true,
    ous: true,
    groups: true
  });

  const [selectedRoleFolder, setSelectedRoleFolder] = useState<string>('all');
  const [folderViewMode, setFolderViewMode] = useState<'focused' | 'accordion'>('focused');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    etudiant: true,
    stagiaire: true,
    employer: true,
    formateur: true,
    dg_rh: true,
    admin: true,
  });
  const [userGroupFilter, setUserGroupFilter] = useState<string>('all');

  const handleCopyText = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setIsCopiedUpn(label);
      setTimeout(() => setIsCopiedUpn(null), 2000);
    }
  };

  const uniqueGroupsList = useMemo(() => {
    const setG = new Set<string>();
    systemGroups.forEach(g => { if (g.name) setG.add(g.name); });
    allUsers.forEach(u => { if (u.group_name) setG.add(u.group_name); });
    return Array.from(setG).sort();
  }, [systemGroups, allUsers]);

  const ROLE_FOLDERS = useMemo(() => [
    {
      id: 'all',
      name: 'Tous les comptes',
      fullName: 'Tous les Objets (Forêt)',
      shortName: 'Tous',
      ouPath: 'DC=eschola,DC=pro',
      subtitle: 'Annuaire global',
      description: 'Vue consolidée de l’ensemble des objets utilisateurs de la forêt Active Directory.',
      roles: ALL_ROLES,
      defaultRole: 'étudiant',
      count: allUsers.length,
      icon: Folder,
      activeIcon: FolderOpen,
    },
    {
      id: 'admin',
      name: 'Administrateurs',
      fullName: 'OU=Administration',
      shortName: 'Admins',
      ouPath: 'OU=Administration,DC=eschola,DC=pro',
      subtitle: 'Privileged Accounts',
      description: 'Comptes dotés de privilèges d’administration centrale et de gouvernance système.',
      roles: ADMIN_ROLES,
      defaultRole: 'admin',
      count: allUsers.filter(u => ADMIN_ROLES.includes(u.role)).length,
      icon: Shield,
      activeIcon: FolderOpen,
    },
    {
      id: 'formateur',
      name: 'Formateurs & Pédagogie',
      fullName: 'OU=Faculty_Staff',
      shortName: 'Formateurs',
      ouPath: 'OU=Faculty_Staff,DC=eschola,DC=pro',
      subtitle: 'Corps Enseignant',
      description: 'Professeurs, formateurs experts, coordinateurs et tuteurs pédagogiques.',
      roles: ['formateur', 'pedagogique'],
      defaultRole: 'formateur',
      count: allUsers.filter(u => ['formateur', 'pedagogique'].includes(u.role)).length,
      icon: BookOpen,
      activeIcon: FolderOpen,
    },
    {
      id: 'dg_rh',
      name: 'Direction & RH',
      fullName: 'OU=Governance_HR',
      shortName: 'DG / RH',
      ouPath: 'OU=Governance_HR,DC=eschola,DC=pro',
      subtitle: 'Supervision & RH',
      description: 'Membres de la direction générale et responsables des ressources humaines.',
      roles: ['dg_rh', 'dg/rh'],
      defaultRole: 'dg_rh',
      count: allUsers.filter(u => ['dg_rh', 'dg/rh'].includes(u.role)).length,
      icon: ShieldCheck,
      activeIcon: FolderOpen,
    },
    {
      id: 'etudiant',
      name: 'Étudiants',
      fullName: 'OU=Learners_Students',
      shortName: 'Étudiants',
      ouPath: 'OU=Learners_Students,DC=eschola,DC=pro',
      subtitle: 'Formation Initiale',
      description: 'Apprenants inscrits aux filières académiques et cycles réguliers.',
      roles: ['étudiant'],
      defaultRole: 'étudiant',
      count: allUsers.filter(u => u.role === 'étudiant').length,
      icon: GraduationCap,
      activeIcon: FolderOpen,
    },
    {
      id: 'stagiaire',
      name: 'Stagiaires',
      fullName: 'OU=Learners_Interns',
      shortName: 'Stagiaires',
      ouPath: 'OU=Learners_Interns,DC=eschola,DC=pro',
      subtitle: 'Immersion & PFE',
      description: 'Stagiaires en immersion professionnelle d’entreprise et projets de fin d’études.',
      roles: ['stagiaire'],
      defaultRole: 'stagiaire',
      count: allUsers.filter(u => u.role === 'stagiaire').length,
      icon: Clock,
      activeIcon: FolderOpen,
    },
    {
      id: 'employer',
      name: 'Employés & Partenaires',
      fullName: 'OU=Learners_Corporate',
      shortName: 'Employés',
      ouPath: 'OU=Learners_Corporate,DC=eschola,DC=pro',
      subtitle: 'Formation Continue',
      description: 'Salariés et cadres d’entreprises en cycle de montée en compétences.',
      roles: ['employer'],
      defaultRole: 'employer',
      count: allUsers.filter(u => u.role === 'employer').length,
      icon: Briefcase,
      activeIcon: FolderOpen,
    }
  ], [allUsers]);

  const handleOpenCreateUserInFolder = (roleFolderId?: string) => {
    const targetFolder = ROLE_FOLDERS.find(f => f.id === (roleFolderId || selectedRoleFolder));
    if (targetFolder && targetFolder.id !== 'all') {
      setNewAccountRole(targetFolder.defaultRole);
    } else {
      setNewAccountRole('étudiant');
    }
    setCreateAccountError('');
    setIsCreateUserModalOpen(true);
  };

  const filterUsersForFolder = (folderRoles: string[]) => {
    return allUsers.filter(u => {
      // 1. Filtrage par rôle de dossier
      if (!folderRoles.includes(u.role)) return false;

      // 2. Filtrage par Statut Compte AD (UAC)
      if (directoryStatusFilter === 'active' && u.is_active === false) return false;
      if (directoryStatusFilter === 'inactive' && u.is_active !== false) return false;

      // 3. Filtrage par Groupe/Promotion
      if (userGroupFilter !== 'all') {
        if (userGroupFilter === '__none__' && u.group_name) return false;
        if (userGroupFilter !== '__none__' && u.group_name !== userGroupFilter) return false;
      }

      // 4. Recherche textuelle LDAP
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase().trim();
        const emailMatch = u.email?.toLowerCase().includes(q);
        const roleMatch = u.role?.toLowerCase().includes(q);
        const groupMatch = u.group_name ? u.group_name.toLowerCase().includes(q) : false;
        const nomMatch = u.nom ? u.nom.toLowerCase().includes(q) : false;
        const prenomMatch = u.prenom ? u.prenom.toLowerCase().includes(q) : false;
        const usernameMatch = u.username ? u.username.toLowerCase().includes(q) : false;
        const deptMatch = u.departement ? u.departement.toLowerCase().includes(q) : false;
        const specMatch = u.specialisation ? u.specialisation.toLowerCase().includes(q) : false;
        const cinMatch = u.cin ? u.cin.toLowerCase().includes(q) : false;
        return !!(emailMatch || roleMatch || groupMatch || nomMatch || prenomMatch || usernameMatch || deptMatch || specMatch || cinMatch);
      }

      return true;
    });
  };

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const handleOpenEditUserModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditUsername(u.username || '');
    setEditEmail(u.email || '');
    setEditNom(u.nom || '');
    setEditPrenom(u.prenom || '');
    setEditRole(u.role || 'étudiant');
    setEditGroupName(u.group_name || '');
    setEditTelephone(u.telephone || '');
    setEditCin(u.cin || '');
    setEditDateNaissance(u.date_naissance || '');
    setEditAdresse(u.adresse || '');
    setEditVille(u.ville || '');
    setEditPays(u.pays || 'Tunisie');
    setEditDepartement(u.departement || '');
    setEditSpecialisation(u.specialisation || '');
    setEditIsActive(u.is_active !== false);
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
        is_active: editIsActive,
        group_name: editGroupName.trim() || undefined,
        nom: editNom.trim() || undefined,
        prenom: editPrenom.trim() || undefined,
        date_naissance: (editDateNaissance || '').trim() || undefined,
        cin: (editCin || '').trim() || undefined,
        telephone: (editTelephone || '').trim() || undefined,
        adresse: (editAdresse || '').trim() || undefined,
        ville: (editVille || '').trim() || undefined,
        pays: (editPays || '').trim() || undefined,
        departement: (editDepartement || '').trim() || undefined,
        specialisation: (editSpecialisation || '').trim() || undefined,
        password: editPassword.trim() || undefined,
      });

      setAllUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data : u)));
      if (user && editingUser.id === user.id) {
        setUser(res.data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth_user_updated'));
          window.dispatchEvent(new Event('storage'));
        }
      }
      setIsEditUserModalOpen(false);
      setEditingUser(null);
      setActionMessage({ type: 'success', text: `Compte utilisateur "${res.data.username || res.data.email}" modifié avec succès.` });
    } catch (err: any) {
      let msg = "Erreur lors de la modification de l'utilisateur.";
      if (err?.response?.data) {
        const d = err.response.data;
        if (typeof d === 'string') {
          msg = d;
        } else if (typeof d.detail === 'string') {
          msg = d.detail;
        } else if (Array.isArray(d.detail)) {
          msg = d.detail
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item?.loc && item?.msg) {
                const field = item.loc[item.loc.length - 1];
                return `${field}: ${item.msg}`;
              }
              return item?.msg || JSON.stringify(item);
            })
            .join(' | ');
        } else if (d.message) {
          msg = d.message;
        }
      } else if (err?.message) {
        msg = err.message;
      }
      setEditUserError(msg);
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
        group_name: newAccountGroupName.trim() || undefined,
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
      setNewAccountGroupName('');
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

  const fetchAdminData = async (role?: string) => {
    setAdminLoading(true);
    try {
      const currentRole = role || user?.role;
      const isAdm = ADMIN_ROLES.includes(currentRole || '');

      const promises: Promise<any>[] = [
        apiClient.get('/courses/').catch(() => ({ data: [] })),
        apiClient.get('/quizzes/').catch(() => ({ data: [] })),
        apiClient.get('/groups/').catch(() => ({ data: [] }))
      ];
      if (isAdm) {
        promises.unshift(apiClient.get('/users/').catch(() => ({ data: [] })));
      }

      const results = await Promise.all(promises);
      if (isAdm) {
        setAllUsers(results[0].data);
        setAllCourses(results[1].data);
        setAllQuizzes(results[2].data);
        setSystemGroups(Array.isArray(results[3].data) ? results[3].data : []);
      } else {
        setAllCourses(results[0].data);
        setAllQuizzes(results[1].data);
        setSystemGroups(Array.isArray(results[2].data) ? results[2].data : []);
        setAdminTab('quizzes');
      }

    } catch (err) {
      console.error('Failed to load management data:', err);
    } finally {
      setAdminLoading(false);
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
        if (ADMIN_ROLES.includes(res.data.role) || ['formateur', 'pedagogique', 'dg_rh', 'dg/rh'].includes(res.data.role)) {
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

  const handleDeleteQuizInProfile = (quizId: number, title?: string) => {
    handleRequestDeleteQuiz(quizId, title);
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

  const handleRequestToggleStatus = (targetUser: UserProfile) => {
    const newStatus = targetUser.is_active === false ? true : false;
    setConfirmModal({
      isOpen: true,
      type: 'status_toggle',
      targetUser,
      targetNewStatus: newStatus,
      isProcessing: false,
    });
  };

  const handleRequestBulkToggleStatus = (newStatus: boolean) => {
    setConfirmModal({
      isOpen: true,
      type: 'bulk_status_toggle',
      targetNewStatus: newStatus,
      isProcessing: false,
    });
  };

  const handleRequestDeleteUser = (targetUser: UserProfile) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete_user',
      targetUser,
      targetId: targetUser.id,
      targetTitle: targetUser.email,
      isProcessing: false,
    });
  };

  const handleRequestDeleteCourse = (courseId: number, title: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete_course',
      targetId: courseId,
      targetTitle: title,
      isProcessing: false,
    });
  };

  const handleRequestDeleteQuiz = (quizId: number, title?: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete_quiz',
      targetId: quizId,
      targetTitle: title || `Quiz #${quizId}`,
      isProcessing: false,
    });
  };

  const handleExecuteConfirmAction = async () => {
    if (!confirmModal.isOpen) return;
    setConfirmModal((prev) => ({ ...prev, isProcessing: true }));

    try {
      if (confirmModal.type === 'status_toggle' && confirmModal.targetUser) {
        const targetUser = confirmModal.targetUser;
        const newStatus = confirmModal.targetNewStatus ?? (targetUser.is_active === false ? true : false);
        const res = await apiClient.put(`/users/${targetUser.id}/status`, { is_active: newStatus });
        setAllUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: res.data.is_active } : u)));
        if (user && user.id === targetUser.id) {
          setUser((prev) => (prev ? { ...prev, is_active: res.data.is_active } : null));
        }
        setActionMessage({
          type: 'success',
          text: `Compte "${targetUser.email}" ${newStatus ? 'réactivé (connexion autorisée)' : 'suspendu et désactivé'} avec succès.`,
        });
      } else if (confirmModal.type === 'bulk_status_toggle') {
        const newStatus = confirmModal.targetNewStatus ?? true;
        const res = await apiClient.put('/users/batch/status', {
          is_active: newStatus,
        });
        setAllUsers((prev) =>
          prev.map((u) => (ADMIN_ROLES.includes(u.role) || isRootAdmin(u) ? u : { ...u, is_active: newStatus }))
        );
        setActionMessage({
          type: 'success',
          text: res.data?.message || `Tous les utilisateurs non-administrateurs ont été ${newStatus ? 'activés (connexion autorisée)' : 'suspendus'}.`,
        });
      } else if (confirmModal.type === 'delete_user' && confirmModal.targetId) {
        await apiClient.delete(`/users/${confirmModal.targetId}`);
        setAllUsers((prev) => prev.filter((u) => u.id !== confirmModal.targetId));
        setActionMessage({ type: 'success', text: `Utilisateur "${confirmModal.targetTitle || confirmModal.targetId}" supprimé.` });
      } else if (confirmModal.type === 'delete_course' && confirmModal.targetId) {
        await apiClient.delete(`/courses/${confirmModal.targetId}`);
        setAllCourses((prev) => prev.filter((c) => c.id !== confirmModal.targetId));
        setActionMessage({ type: 'success', text: `Cours "${confirmModal.targetTitle}" supprimé avec succès.` });
      } else if (confirmModal.type === 'delete_quiz' && confirmModal.targetId) {
        await apiClient.delete(`/quizzes/${confirmModal.targetId}`);
        setAllQuizzes((prev) => prev.filter((q) => q.id !== confirmModal.targetId));
        setActionMessage({ type: 'success', text: `Quiz "${confirmModal.targetTitle}" supprimé avec succès.` });
      }
      setConfirmModal((prev) => ({ ...prev, isOpen: false, isProcessing: false }));
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || "Une erreur est survenue lors de l'exécution de l'action.";
      setActionMessage({ type: 'error', text: errorMsg });
      setConfirmModal((prev) => ({ ...prev, isProcessing: false }));
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
  const isStaffUser = isAdminUser || ['formateur', 'pedagogique', 'dg_rh', 'dg/rh'].includes(user.role);

  return (
    <div className="min-h-screen bg-white text-slate-900 px-4 sm:px-8 pt-24 sm:pt-28 pb-16 space-y-8 max-w-7xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Paramètres & Profil</h1>
          <p className="text-slate-500 mt-1">Gérez vos informations personnelles et vos préférences.</p>
        </div>
        {isAdminUser && (
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-[#1877f2] border border-blue-200 text-xs font-bold w-fit shadow-2xs">
            <Shield size={16} /> {isSuperAdmin ? 'Mode Super-Administrateur Actif' : isAdminManager ? 'Mode Admin Manager Actif' : 'Mode Administrateur Actif'}
          </span>
        )}
      </div>

      {/* Profil Card (Visible par tous les utilisateurs) */}
      <UserProfileCard user={user} onProfileUpdated={(updated) => setUser(updated)} />

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
                    {isAdminUser ? 'Outils Administrateur' : user.role === 'dg_rh' || user.role === 'dg/rh' ? 'Espace DG / RH & Supervision' : 'Espace Formateur & Évaluations'}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {isAdminUser
                      ? "Espace réservé à l'administration pour piloter les utilisateurs, cours et évaluations."
                      : user.role === 'dg_rh' || user.role === 'dg/rh'
                        ? "Espace dédié DG / RH pour la supervision pédagogique, la gestion des cours et les évaluations."
                        : "Espace exclusif réservé aux formateurs pour gérer les cours et les quiz."}
                  </p>
                </div>
              </div>
            </div>

            {isAdminUser && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1877f2] to-[#2563eb] hover:from-[#166fe5] hover:to-[#1d4ed8] text-white font-bold text-sm shadow-sm hover:shadow-md transition-all self-start md:self-center shrink-0 cursor-pointer"
              >
                <ShieldCheck size={18} /> Console d'Administration Complète &rarr;
              </Link>
            )}
          </div>

          {/* Onglets de navigation */}
          <div className="flex items-center bg-surface p-1 rounded-xl border border-border flex-wrap gap-1">
              {isAdminUser && (
                <button
                  onClick={() => setAdminTab('users')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${adminTab === 'users' ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  <Users size={16} /> Utilisateurs ({allUsers.length})
                </button>
              )}
              <button
                onClick={() => setAdminTab('courses')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${adminTab === 'courses' ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                <BookOpen size={16} /> Cours ({allCourses.length})
              </button>
              <button
                onClick={() => setAdminTab('quizzes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${adminTab === 'quizzes' ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                <Award size={16} /> Quiz ({allQuizzes.length})
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setAdminTab('system')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${adminTab === 'system' ? 'bg-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  <Database size={16} /> Base de Données & Backend (Admin)
                </button>
              )}
            </div>

          {/* Feedback messages */}
          {actionMessage && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${actionMessage.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
              {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* TAB 1 : CONSOLE ACTIVE DIRECTORY & ENTRA ID (GESTION DES OBJETS ET ANNUAIRE) */}
          {isAdminUser && adminTab === 'users' && (() => {
            const activeFolder = ROLE_FOLDERS.find(f => f.id === selectedRoleFolder) || ROLE_FOLDERS[0];
            const activeFolderUsers = filterUsersForFolder(activeFolder.roles);
            const selectedDirectoryUser = (selectedDirectoryUserId !== null ? allUsers.find(u => u.id === selectedDirectoryUserId) : null) || activeFolderUsers[0] || null;

            const enabledUsersCount = allUsers.filter(u => u.is_active !== false).length;
            const disabledUsersCount = allUsers.filter(u => u.is_active === false).length;
            const nonAdminUsersCount = allUsers.filter(u => !ADMIN_ROLES.includes(u.role) && !isRootAdmin(u)).length;

            const isSelectedUserRoot = selectedDirectoryUser ? isRootAdmin(selectedDirectoryUser) : false;
            const isSelectedUserCurrent = selectedDirectoryUser ? selectedDirectoryUser.id === user.id : false;
            const isSelectedUserAdmin = selectedDirectoryUser ? ADMIN_ROLES.includes(selectedDirectoryUser.role) : false;
            const canModifySelected = selectedDirectoryUser
              ? (isSuperAdmin ? (!isSelectedUserCurrent && !isSelectedUserRoot) : (!isSelectedUserCurrent && !isSelectedUserAdmin && !isSelectedUserRoot))
              : false;

            return (
              <div className="space-y-6 animate-fade-in">

                {/* BANNIÈRE ACTIVE DIRECTORY & TÉLÉMÉTRIE DE FORÊT (THÈME OFFICIEL DE L'APPLICATION) */}
                <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-indigo-50/40 text-slate-900 shadow-sm border border-blue-200/80 space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1877f2] to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 ring-2 ring-blue-400/20 shrink-0">
                        <Network size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-xl font-black text-slate-900 tracking-tight">
                            Active Directory & Entra ID Web Console
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            AD DS Online
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap font-mono">
                          <span>Forêt : <strong className="text-[#1877f2] font-bold">DC=eschola,DC=pro</strong></span>
                          <span>•</span>
                          <span>Contrôleur : <strong className="text-slate-800 font-semibold">DC01.eschola.pro</strong></span>
                          <span>•</span>
                          <span>Schéma : <strong className="text-slate-800 font-semibold">v2026.3 Active</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start lg:self-center">
                      <span className="text-[11px] px-3 py-1.5 rounded-xl bg-white border border-blue-200/80 text-slate-700 font-mono shadow-2xs flex items-center gap-1.5">
                        <Terminal size={13} className="text-[#1877f2]" />
                        <span>LDAP://127.0.0.1:389</span>
                      </span>
                    </div>
                  </div>

                  {/* 4 CARTES KPI TÉLÉMÉTRIQUES ACTIVE DIRECTORY (THÈME CLAIR & 3D) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all">
                      <div className="flex items-center justify-between text-slate-500 mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Objets Utilisateurs</span>
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1877f2] flex items-center justify-center">
                          <Users size={15} />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-slate-900 tracking-tight">{allUsers.length}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Total comptes annuaire</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all">
                      <div className="flex items-center justify-between text-slate-500 mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Comptes Activés (0x0200)</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <UserCheck size={15} />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-emerald-600 tracking-tight">{enabledUsersCount}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Connexion autorisée</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-rose-300 transition-all">
                      <div className="flex items-center justify-between text-slate-500 mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Comptes Suspendus (0x0202)</span>
                        <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                          <UserX size={15} />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-rose-600 tracking-tight">{disabledUsersCount}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Accès verrouillé</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all">
                      <div className="flex items-center justify-between text-slate-500 mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Unités d'Org. (OU)</span>
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1877f2] flex items-center justify-center">
                          <FolderTree size={15} />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-[#1877f2] tracking-tight">{ROLE_FOLDERS.length - 1} OU</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{uniqueGroupsList.length} Groupes de Sécurité</p>
                    </div>
                  </div>
                </div>

                {/* RUBAN DE COMMANDES ACTIVE DIRECTORY (ACTION BAR) */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
                    {/* Actions de l'objet sélectionné */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenCreateUserInFolder(activeFolder.id)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <UserPlus size={14} />
                        <span>+ Nouvel Objet</span>
                      </button>

                      <button
                        type="button"
                        disabled={!selectedDirectoryUser || !canModifySelected}
                        onClick={() => selectedDirectoryUser && handleRequestToggleStatus(selectedDirectoryUser)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                          !selectedDirectoryUser || !canModifySelected
                            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                            : selectedDirectoryUser.is_active !== false
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 cursor-pointer'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                        }`}
                        title={
                          !selectedDirectoryUser
                            ? 'Sélectionnez un utilisateur'
                            : selectedDirectoryUser.is_active !== false
                              ? 'Suspendre le compte sélectionné'
                              : 'Activer le compte sélectionné'
                        }
                      >
                        <Power size={13} />
                        <span>
                          {selectedDirectoryUser && selectedDirectoryUser.is_active === false ? 'Activer Compte' : 'Désactiver Compte'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={!selectedDirectoryUser || (isSuperAdmin ? false : isSelectedUserAdmin)}
                        onClick={() => {
                          if (selectedDirectoryUser) {
                            setResetPasswordUser(selectedDirectoryUser);
                            setNewResetPassword('');
                            setResetPasswordError('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Réinitialiser le mot de passe de l'utilisateur"
                      >
                        <Key size={13} className="text-blue-600" />
                        <span>Mot de passe</span>
                      </button>

                      <button
                        type="button"
                        disabled={!selectedDirectoryUser}
                        onClick={() => selectedDirectoryUser && handleOpenEditUserModal(selectedDirectoryUser)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Modifier les attributs LDAP et propriétés"
                      >
                        <Pencil size={13} className="text-slate-600" />
                        <span>Propriétés</span>
                      </button>

                      <button
                        type="button"
                        disabled={!selectedDirectoryUser || !canModifySelected}
                        onClick={() => selectedDirectoryUser && handleRequestDeleteUser(selectedDirectoryUser)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Supprimer l'objet de l'annuaire"
                      >
                        <Trash2 size={13} className="text-rose-500" />
                        <span>Supprimer</span>
                      </button>
                    </div>

                    {/* Actions de masse sur l'annuaire (Bulk Operations) */}
                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleRequestBulkToggleStatus(true)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                        title="Activer la connexion pour tous les utilisateurs (sauf les comptes admin et admin_manager)"
                      >
                        <Zap size={13} className="text-emerald-600 fill-emerald-600" />
                        <span>Activer Tous</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-200/60 text-emerald-900 font-semibold">
                          sauf admins
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRequestBulkToggleStatus(false)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                        title="Suspendre la connexion pour tous les utilisateurs (sauf les comptes admin et admin_manager)"
                      >
                        <Power size={13} className="text-rose-600" />
                        <span>Suspendre Tous</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-200/60 text-rose-900 font-semibold">
                          sauf admins
                        </span>
                      </button>
                    </div>

                    {/* Contrôles utilitaires */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fetchAdminData()}
                        disabled={adminLoading}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Actualiser la liste Active Directory"
                      >
                        <RefreshCw size={13} className={adminLoading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                        <span className="hidden sm:inline">Actualiser</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsInspectorOpen(prev => !prev)}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isInspectorOpen
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title="Afficher/Masquer le volet des attributs LDAP"
                      >
                        <SlidersHorizontal size={13} />
                        <span className="hidden sm:inline">Inspecteur LDAP</span>
                      </button>
                    </div>
                  </div>

                  {/* BARRE DE RECHERCHE LDAP & FILTRES RAPIDES */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                    {/* Champ de recherche LDAP */}
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder={`Filtre LDAP dans ${activeFolder.fullName} (sAMAccountName, mail, nom, prénom, UPN)...`}
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all text-slate-900 placeholder:text-slate-400 font-mono"
                      />
                      {userSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setUserSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Filtre de statut UAC */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <Power size={12} className="text-slate-400" />
                        <span className="text-[11px] text-slate-500 font-semibold">UAC :</span>
                        <select
                          value={directoryStatusFilter}
                          onChange={(e) => setDirectoryStatusFilter(e.target.value as any)}
                          className="bg-transparent text-slate-800 font-semibold text-xs outline-none cursor-pointer"
                        >
                          <option value="all">Tous statuts</option>
                          <option value="active">🟢 Activés (0x0200)</option>
                          <option value="inactive">🔴 Suspendus (0x0202)</option>
                        </select>
                      </div>

                      {/* Filtre par groupe de sécurité */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <Users size={12} className="text-slate-400" />
                        <span className="text-[11px] text-slate-500 font-semibold">Groupe :</span>
                        <select
                          value={userGroupFilter}
                          onChange={(e) => setUserGroupFilter(e.target.value)}
                          className="bg-transparent text-slate-800 font-semibold text-xs outline-none cursor-pointer max-w-[150px] truncate"
                        >
                          <option value="all">Tous les groupes</option>
                          <option value="__none__">Sans groupe</option>
                          {uniqueGroupsList.map((g) => (
                            <option key={g} value={g}>
                              👥 {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* POSTE DE TRAVAIL EN 2 COLONNES (ARBORESCENCE OU + GRILLE D'OBJETS) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

                  {/* COLONNE GAUCHE : ARBORESCENCE ACTIVE DIRECTORY (OU & GROUPES) */}
                  <div className="lg:col-span-4 xl:col-span-3 space-y-4">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                      
                      {/* Noeud Racine Domaine */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Network size={16} className="text-blue-600" />
                          <span className="text-xs font-black text-slate-900 font-mono">DC=eschola,DC=pro</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {allUsers.length}
                        </span>
                      </div>

                      {/* Section Unités d'Organisation (OU) */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1">
                          <span className="flex items-center gap-1.5">
                            <FolderTree size={12} className="text-slate-500" />
                            <span>Unités d'Organisation (OU)</span>
                          </span>
                        </div>

                        <div className="space-y-1">
                          {ROLE_FOLDERS.map((folder) => {
                            const isSelected = selectedRoleFolder === folder.id;
                            const FolderIcon = isSelected ? folder.activeIcon : folder.icon;

                            return (
                              <button
                                key={folder.id}
                                type="button"
                                onClick={() => setSelectedRoleFolder(folder.id)}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs ring-1 ring-blue-500/10'
                                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FolderIcon
                                    size={15}
                                    className={isSelected ? 'text-blue-600 shrink-0' : 'text-slate-400 group-hover:text-slate-600 shrink-0'}
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium leading-tight">{folder.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono truncate">{folder.ouPath}</p>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-1 ${
                                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {folder.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section Groupes de Sécurité (memberOf) */}
                      {uniqueGroupsList.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck size={12} className="text-slate-500" />
                              <span>Groupes de Sécurité</span>
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">{uniqueGroupsList.length}</span>
                          </div>

                          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                            <button
                              type="button"
                              onClick={() => setUserGroupFilter('all')}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                userGroupFilter === 'all'
                                  ? 'bg-slate-100 font-bold text-slate-900'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">Tous les groupes</span>
                              <span className="text-[10px] text-slate-400">{allUsers.length}</span>
                            </button>

                            {uniqueGroupsList.map((grp) => {
                              const isGrpActive = userGroupFilter === grp;
                              const grpCount = allUsers.filter(u => u.group_name === grp).length;

                              return (
                                <button
                                  key={grp}
                                  type="button"
                                  onClick={() => setUserGroupFilter(grp)}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                    isGrpActive
                                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                                      : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="truncate flex items-center gap-1.5 font-mono text-[11px]">
                                    <Users size={11} className="text-slate-400" />
                                    {grp}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                                    {grpCount}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Métadonnées de Sécurité Active Directory */}
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1 font-mono">
                        <div className="flex items-center justify-between">
                          <span>Auth Provider :</span>
                          <span className="font-bold text-slate-700">JWT + SQLite LDAP</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Sync Mode :</span>
                          <span className="font-bold text-emerald-600">Direct In-Memory</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* COLONNE DROITE : GRILLE DE DONNÉES DES OBJETS ACTIVE DIRECTORY */}
                  <div className="lg:col-span-8 xl:col-span-9 space-y-4">
                    
                    {/* Fil d'Ariane LDAP / Chemin de l'Objet */}
                    <div className="flex items-center justify-between text-xs px-1 text-slate-500">
                      <div className="flex items-center gap-1.5 font-mono">
                        <FolderOpen size={13} className="text-blue-600" />
                        <span className="text-slate-900 font-bold">LDAP://DC=eschola,DC=pro</span>
                        <span>/</span>
                        <span className="text-blue-600 font-bold">{activeFolder.ouPath}</span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {activeFolderUsers.length} Objet(s) affiché(s)
                      </span>
                    </div>

                    {/* TABLEAU DES OBJETS ACTIVE DIRECTORY */}
                    {activeFolderUsers.length === 0 ? (
                      <div className="py-14 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Network size={28} />
                        </div>
                        <p className="text-sm font-bold text-slate-800">Aucun objet Active Directory trouvé</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          Aucun compte ne correspond aux filtres ou à la recherche dans l'unité d'organisation <strong>{activeFolder.ouPath}</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenCreateUserInFolder(activeFolder.id)}
                          className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <UserPlus size={15} />
                          <span>Créer un compte {activeFolder.shortName}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold tracking-wider border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3.5">Objet / Display Name (cn)</th>
                              <th className="px-4 py-3.5">User Principal Name (UPN)</th>
                              <th className="px-4 py-3.5">Object Class / Rôle</th>
                              <th className="px-4 py-3.5">Groupe (memberOf)</th>
                              <th className="px-4 py-3.5">État Compte (UAC)</th>
                              <th className="px-4 py-3.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeFolderUsers.map((u) => {
                              const isSelected = selectedDirectoryUserId === u.id || (selectedDirectoryUserId === null && selectedDirectoryUser?.id === u.id);
                              const isCurrentUser = u.id === user.id;
                              const isTargetAdmin = ADMIN_ROLES.includes(u.role);
                              const isRoot = isRootAdmin(u);
                              const canModifyTargetRole = isSuperAdmin ? (!isCurrentUser && !isRoot) : (!isCurrentUser && !isTargetAdmin && !isRoot);
                              const canToggleStatus = isSuperAdmin ? (!isCurrentUser && !isRoot) : (!isCurrentUser && !isTargetAdmin && !isRoot);
                              const canDeleteTarget = isSuperAdmin ? (!isCurrentUser && !isRoot) : (!isCurrentUser && !isTargetAdmin && !isRoot);
                              const canResetTargetPassword = isSuperAdmin ? true : !isTargetAdmin;

                              const selectableRoles = isSuperAdmin
                                ? ALL_ROLES
                                : (isTargetAdmin ? [u.role] : NON_ADMIN_ROLES);

                              const isLeadershipRole = ADMIN_ROLES.includes(u.role) || u.role === 'dg_rh' || u.role === 'dg/rh' || u.role === 'formateur' || u.role === 'pedagogique';

                              return (
                                <tr
                                  key={u.id}
                                  onClick={() => setSelectedDirectoryUserId(u.id)}
                                  className={`transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-50/70 border-l-4 border-l-blue-600 font-medium'
                                      : 'hover:bg-slate-50/70 border-l-4 border-l-transparent'
                                  }`}
                                >
                                  {/* Colonne 1: Objet & Display Name */}
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      {/* Radio indicator */}
                                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                                      </div>

                                      {/* Avatar */}
                                      <div className="relative shrink-0">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-blue-50 text-blue-600 border border-blue-200">
                                          {u.email.charAt(0).toUpperCase()}
                                        </div>
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                          u.is_active !== false ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} />
                                      </div>

                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-900 truncate">
                                          {[u.prenom, u.nom].filter(Boolean).join(' ') || u.email.split('@')[0]}
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-mono truncate">
                                          @{u.username || u.email.split('@')[0]} • ID #{u.id} {isCurrentUser && '(Vous)'}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Colonne 2: UPN */}
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-slate-700 text-xs truncate max-w-[180px]">
                                        {u.email}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyText(u.email, `upn-${u.id}`);
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors rounded"
                                        title="Copier le UserPrincipalName"
                                      >
                                        {isCopiedUpn === `upn-${u.id}` ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                      </button>
                                    </div>
                                  </td>

                                  {/* Colonne 3: Object Class / Rôle */}
                                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                        isLeadershipRole
                                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                      }`}>
                                        {u.role === 'dg_rh' || u.role === 'dg/rh' ? 'DG / RH' : u.role}
                                      </span>

                                      {canModifyTargetRole && (
                                        <select
                                          value={u.role}
                                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                          className="px-2 py-1 rounded bg-white border border-slate-200 text-[10px] text-slate-700 outline-none focus:border-blue-600 transition-all cursor-pointer"
                                        >
                                          {selectableRoles.map((r) => (
                                            <option key={r} value={r}>
                                              {r === 'dg_rh' ? 'DG / RH' : r}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  </td>

                                  {/* Colonne 4: Groupe / memberOf */}
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono bg-slate-50 text-slate-700 border border-slate-200">
                                      <Users size={11} className="text-slate-400 shrink-0" />
                                      <span className="truncate max-w-[120px]">{u.group_name || 'Non assigné'}</span>
                                    </span>
                                  </td>

                                  {/* Colonne 5: État Compte (UAC) */}
                                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                      {u.is_active !== false ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                          <span>0x0200 Activé</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                          <span>0x0202 Suspendu</span>
                                        </span>
                                      )}

                                      {canToggleStatus && (
                                        <button
                                          type="button"
                                          onClick={() => handleRequestToggleStatus(u)}
                                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs ${
                                            u.is_active !== false
                                              ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                          }`}
                                          title={u.is_active !== false ? "Suspendre l'accès utilisateur" : "Réactiver l'accès utilisateur"}
                                        >
                                          <Power size={10} />
                                          <span>{u.is_active !== false ? 'Désactiver' : 'Activer'}</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  {/* Colonne 6: Actions rapides */}
                                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => handleOpenEditUserModal(u)}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                        title="Modifier les propriétés de cet objet"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      {canResetTargetPassword && (
                                        <button
                                          onClick={() => {
                                            setResetPasswordUser(u);
                                            setNewResetPassword('');
                                            setResetPasswordError('');
                                          }}
                                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                          title="Modifier le mot de passe"
                                        >
                                          <Key size={14} />
                                        </button>
                                      )}
                                      {canDeleteTarget && (
                                        <button
                                          onClick={() => handleRequestDeleteUser(u)}
                                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                          title="Supprimer cet objet de l'annuaire"
                                        >
                                          <Trash2 size={14} />
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
                    )}

                    {/* VOLET D'INSPECTION D'OBJET ACTIVE DIRECTORY (LDAP PROPERTY INSPECTOR) */}
                    {isInspectorOpen && selectedDirectoryUser && (
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4 animate-fade-in">
                        
                        {/* En-tête de l'inspecteur */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-black text-base shrink-0">
                              {selectedDirectoryUser.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-black text-slate-900">
                                  {[selectedDirectoryUser.prenom, selectedDirectoryUser.nom].filter(Boolean).join(' ') || selectedDirectoryUser.email}
                                </h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  selectedDirectoryUser.is_active !== false
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  {selectedDirectoryUser.is_active !== false ? '● Compte Activé' : '● Compte Suspendu'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                <span>CN={selectedDirectoryUser.username || selectedDirectoryUser.email.split('@')[0]},OU={selectedDirectoryUser.role},DC=eschola,DC=pro</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(`CN=${selectedDirectoryUser.username || selectedDirectoryUser.email.split('@')[0]},OU=${selectedDirectoryUser.role},DC=eschola,DC=pro`, 'dn')}
                                  className="text-slate-400 hover:text-blue-600 transition-colors"
                                  title="Copier le Distinguished Name"
                                >
                                  {isCopiedUpn === 'dn' ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                </button>
                              </p>
                            </div>
                          </div>

                          {/* Onglets de l'inspecteur */}
                          <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-xl text-xs self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setDirectoryInspectorTab('attributes')}
                              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                directoryInspectorTab === 'attributes'
                                  ? 'bg-white text-blue-600 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Attributs LDAP
                            </button>
                            <button
                              type="button"
                              onClick={() => setDirectoryInspectorTab('groups')}
                              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                directoryInspectorTab === 'groups'
                                  ? 'bg-white text-blue-600 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Groupes (memberOf)
                            </button>
                            <button
                              type="button"
                              onClick={() => setDirectoryInspectorTab('security')}
                              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                directoryInspectorTab === 'security'
                                  ? 'bg-white text-blue-600 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Sécurité & Contrôle
                            </button>
                          </div>
                        </div>

                        {/* Contenu de l'onglet : Attributs LDAP */}
                        {directoryInspectorTab === 'attributes' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">sAMAccountName</span>
                              <p className="font-mono font-bold text-slate-800">{selectedDirectoryUser.username || selectedDirectoryUser.email.split('@')[0]}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">userPrincipalName (UPN)</span>
                              <p className="font-mono font-bold text-slate-800">{selectedDirectoryUser.email}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">givenName / sn (Prénom & Nom)</span>
                              <p className="font-bold text-slate-800">
                                {[selectedDirectoryUser.prenom, selectedDirectoryUser.nom].filter(Boolean).join(' ') || 'Non renseigné'}
                              </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">telephoneNumber</span>
                              <p className="font-mono font-bold text-slate-800">{selectedDirectoryUser.telephone || 'Non renseigné'}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">department / title</span>
                              <p className="font-bold text-slate-800">
                                {[selectedDirectoryUser.departement, selectedDirectoryUser.specialisation].filter(Boolean).join(' • ') || selectedDirectoryUser.role}
                              </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">userAccountControl (UAC)</span>
                              <p className="font-mono font-bold text-slate-800">
                                {selectedDirectoryUser.is_active !== false ? '0x0200 (NORMAL_ACCOUNT - ENABLED)' : '0x0202 (ACCOUNTDISABLE)'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Contenu de l'onglet : Groupes (memberOf) */}
                        {directoryInspectorTab === 'groups' && (
                          <div className="space-y-3">
                            <p className="text-xs text-slate-500">
                              Appartenances aux groupes de sécurité et rôles pour l'objet <strong>{selectedDirectoryUser.email}</strong> :
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold flex items-center gap-1.5">
                                <ShieldCheck size={14} />
                                <span>CN=Role-{selectedDirectoryUser.role},OU=Roles,DC=eschola,DC=pro</span>
                              </span>

                              {selectedDirectoryUser.group_name && (
                                <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold flex items-center gap-1.5">
                                  <Users size={14} />
                                  <span>CN={selectedDirectoryUser.group_name},OU=SecurityGroups,DC=eschola,DC=pro</span>
                                </span>
                              )}

                              <span className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-xs font-mono flex items-center gap-1.5">
                                <Network size={14} />
                                <span>CN=Domain Users,CN=Users,DC=eschola,DC=pro</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Contenu de l'onglet : Sécurité & Contrôle */}
                        {directoryInspectorTab === 'security' && (
                          <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <h5 className="text-xs font-bold text-slate-900">Statut de la connexion & Contrôle d'accès</h5>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {selectedDirectoryUser.is_active !== false
                                    ? "L'utilisateur peut actuellement se connecter et accéder à tous ses modules."
                                    : "L'accès de cet utilisateur est suspendu. La connexion est immédiatement bloquée."}
                                </p>
                              </div>

                              {canModifySelected && (
                                <button
                                  type="button"
                                  onClick={() => handleRequestToggleStatus(selectedDirectoryUser)}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                                    selectedDirectoryUser.is_active !== false
                                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  <Power size={14} />
                                  <span>{selectedDirectoryUser.is_active !== false ? 'Suspendre la Connexion' : 'Autoriser la Connexion'}</span>
                                </button>
                              )}
                            </div>

                            {isSelectedUserRoot && (
                              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                                <span>Cet objet est un Administrateur Racine protégé en écriture. Son statut et son rôle ne peuvent pas être altérés.</span>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    )}

                  </div>

                </div>

              </div>
            );
          })()}

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
                            onClick={() => handleRequestDeleteCourse(course.id, course.title)}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
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
                              onClick={() => handleRequestDeleteQuiz(quiz.id, quiz.title)}
                              className="p-2 rounded-xl text-text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
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
                    { title: "Salles vidéo conférence", table: "classrooms", link: `${backendBaseUrl}/admin/classroom/list`, icon: Video, desc: "Salles vidéo conférence & hôtes" },
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
                        { method: "GET", route: "/classrooms/", role: "Authentifié", desc: "Salles vidéo conférence en direct" },
                        { method: "GET", route: "/messages/inbox", role: "Authentifié", desc: "Boîte de réception de la messagerie interne" },
                        { method: "POST", route: "/upload/file", role: "Authentifié", desc: "Téléversement de tout type de fichier ou document" },
                      ].map((ep, i) => (
                        <tr key={i} className="hover:bg-surface/50 transition-colors">
                          <td className="py-2.5 pr-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${ep.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
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
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase text-text-secondary">
                        Rôle assigné au compte *
                      </label>
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                        📁 {ROLE_FOLDERS.find(f => f.roles.includes(newAccountRole))?.name || 'Dossier Général'}
                      </span>
                    </div>
                    <select
                      value={newAccountRole}
                      onChange={(e) => setNewAccountRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:border-primary outline-none text-xs font-semibold text-text-primary"
                    >
                      {(isSuperAdmin ? ALL_ROLES : NON_ADMIN_ROLES).map((roleOpt) => (
                        <option key={roleOpt} value={roleOpt} className="bg-background">
                          {roleOpt === 'dg_rh' ? 'DG / RH' : roleOpt.charAt(0).toUpperCase() + roleOpt.slice(1)}
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

                        {/* Groupe pédagogique / Classe */}
                        {['étudiant', 'stagiaire', 'employer'].includes(newAccountRole) && (
                          <div>
                            <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                              Groupe Pédagogique / Classe <span className="text-text-secondary/60 font-normal">(Optionnel)</span>
                            </label>
                            <select
                              value={newAccountGroupName}
                              onChange={(e) => setNewAccountGroupName(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-primary outline-none text-xs text-text-primary cursor-pointer"
                            >
                              <option value="">-- Assigner automatiquement au groupe par défaut --</option>
                              {systemGroups.map((g) => (
                                <option key={g.id} value={g.name}>
                                  {g.name} {g.level ? `(${g.level})` : ''}
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
                          <span className={`text-sm font-black font-mono block ${att.percentage >= 60 ? 'text-emerald-500' : 'text-rose-500'
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
            <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white max-w-2xl w-full p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto text-slate-900 animate-zoom-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 text-[#1877f2] flex items-center justify-center font-bold shrink-0">
                      <Pencil size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">Modifier l'utilisateur</h3>
                      <p className="text-xs text-slate-500 font-medium">Édition des informations du compte #{editingUser.id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setIsEditUserModalOpen(false); setEditingUser(null); }}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-bold cursor-pointer"
                    aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>

                {editUserError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 font-semibold">
                    <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
                    <span className="break-words leading-relaxed">{String(editUserError)}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Rôle *</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold cursor-pointer"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>{r === 'dg_rh' ? 'DG / RH' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nom d'utilisateur</label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nom</label>
                      <input
                        type="text"
                        value={editNom}
                        onChange={(e) => setEditNom(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Prénom</label>
                      <input
                        type="text"
                        value={editPrenom}
                        onChange={(e) => setEditPrenom(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Adresse Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Téléphone</label>
                      <input
                        type="text"
                        value={editTelephone}
                        onChange={(e) => setEditTelephone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">CIN / Pièce d'identité</label>
                      <input
                        type="text"
                        value={editCin}
                        onChange={(e) => setEditCin(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Date de naissance</label>
                      <input
                        type="date"
                        value={editDateNaissance}
                        onChange={(e) => setEditDateNaissance(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Pays</label>
                      <input
                        type="text"
                        value={editPays}
                        onChange={(e) => setEditPays(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Ville</label>
                      <input
                        type="text"
                        value={editVille}
                        onChange={(e) => setEditVille(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Département (Employé / Stagiaire)</label>
                      <input
                        type="text"
                        value={editDepartement}
                        onChange={(e) => setEditDepartement(e.target.value)}
                        placeholder="Ex: Informatique, RH..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Spécialisation (Étudiant / Stagiaire)</label>
                      <input
                        type="text"
                        value={editSpecialisation}
                        onChange={(e) => setEditSpecialisation(e.target.value)}
                        placeholder="Ex: Génie Logiciel, Data..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium placeholder:text-slate-400"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Groupe pédagogique / Classe</span>
                        {editingUser.group_name && (
                          <span className="text-[11px] text-[#1877f2] font-normal">Actuel : {editingUser.group_name}</span>
                        )}
                      </label>
                      <select
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-semibold cursor-pointer"
                      >
                        <option value="">-- Aucun groupe / Non assigné --</option>
                        {editingUser.group_name && !systemGroups.some((g) => g.name.toLowerCase() === editingUser.group_name?.toLowerCase()) && (
                          <option value={editingUser.group_name}>
                            {editingUser.group_name} (Actuel)
                          </option>
                        )}
                        {systemGroups.map((grp) => (
                          <option key={grp.id} value={grp.name}>
                            {grp.name} {grp.level ? `(${grp.level})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nouveau mot de passe (optionnel)</label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Laisser vide pour conserver le mot de passe actuel"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono placeholder:text-slate-400"
                      />
                    </div>

                    <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <Power size={14} className={editIsActive ? "text-emerald-600" : "text-rose-600"} />
                          <span>Statut de connexion du compte</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {editIsActive
                            ? "Compte actif : l'utilisateur peut se connecter normalement à la plateforme."
                            : "Compte suspendu : l'accès est bloqué avec message invitant à contacter l'administration."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditIsActive(true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            editIsActive
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Actif
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditIsActive(false)}
                          disabled={isRootAdmin(editingUser) || (editingUser ? editingUser.id === user.id : false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                            !editIsActive
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Suspendu
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => { setIsEditUserModalOpen(false); setEditingUser(null); }}
                      className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold border border-slate-300 transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingUser}
                      className="w-1/2 btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      {isUpdatingUser ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      <span>Enregistrer les modifications</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL 3D CENTRÉ DE CONFIRMATION D'ACTION (THÈME E-SCHOLA PRO)             */}
          {/* ========================================================================= */}
          {confirmModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md animate-fade-in select-none">
              <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35),0_0_40px_rgba(24,119,242,0.12)] p-6 sm:p-8 text-center space-y-5 transform transition-all animate-scale-up">
                
                {/* 3D Floating Glowing Icon Badge */}
                <div className="flex justify-center -mt-2">
                  {confirmModal.type === 'bulk_status_toggle' ? (
                    confirmModal.targetNewStatus ? (
                      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/35 ring-8 ring-emerald-50 transform rotate-3 hover:rotate-0 transition-transform">
                        <Zap size={30} className="drop-shadow-sm fill-white" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/35 ring-8 ring-rose-50 transform -rotate-3 hover:rotate-0 transition-transform">
                        <Power size={30} className="drop-shadow-sm" />
                      </div>
                    )
                  ) : confirmModal.type === 'status_toggle' ? (
                    confirmModal.targetNewStatus ? (
                      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/35 ring-8 ring-emerald-50 transform rotate-3 hover:rotate-0 transition-transform">
                        <Power size={30} className="drop-shadow-sm" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/35 ring-8 ring-rose-50 transform -rotate-3 hover:rotate-0 transition-transform">
                        <Power size={30} className="drop-shadow-sm" />
                      </div>
                    )
                  ) : (
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center shadow-lg shadow-red-600/35 ring-8 ring-red-50 transform -rotate-3 hover:rotate-0 transition-transform">
                      <Trash2 size={30} className="drop-shadow-sm" />
                    </div>
                  )}
                </div>

                {/* Security Chip Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#1877f2] text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                  <Cpu size={13} className="text-[#1877f2] animate-pulse" />
                  <span>
                    {confirmModal.type === 'bulk_status_toggle'
                      ? 'Gouvernance Active Directory • Traitement Global'
                      : 'E-Schola Pro Sécurité'}
                  </span>
                </div>

                {/* Title & Description */}
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {confirmModal.type === 'bulk_status_toggle'
                      ? confirmModal.targetNewStatus
                        ? "Activer Tous les Utilisateurs"
                        : "Suspendre Tous les Utilisateurs"
                      : confirmModal.type === 'status_toggle'
                        ? confirmModal.targetNewStatus
                          ? "Réactiver l'Accès Compte"
                          : "Suspendre la Connexion Compte"
                        : confirmModal.type === 'delete_user'
                          ? "Supprimer cet Utilisateur"
                          : confirmModal.type === 'delete_course'
                            ? "Supprimer ce Cours"
                            : "Supprimer ce Quiz"}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                    {confirmModal.type === 'bulk_status_toggle'
                      ? confirmModal.targetNewStatus
                        ? "Confirmez-vous vouloir réactiver la connexion et rétablir tous les accès pour TOUS les utilisateurs du système (sauf administrateurs) ?"
                        : "Confirmez-vous vouloir suspendre et désactiver la connexion pour TOUS les utilisateurs du système (sauf administrateurs) ?"
                      : confirmModal.type === 'status_toggle'
                        ? confirmModal.targetNewStatus
                          ? "Confirmez-vous vouloir réactiver la connexion et rétablir tous les accès pour ce compte ?"
                          : "Confirmez-vous vouloir suspendre et désactiver la connexion pour ce compte utilisateur ?"
                        : "Êtes-vous certain de vouloir supprimer définitivement cet élément ? Cette action est irréversible."}
                  </p>
                </div>

                {/* Protection administrative explicite pour les opérations de masse */}
                {confirmModal.type === 'bulk_status_toggle' && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200/90 text-left space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-2 text-blue-950 font-bold text-xs">
                      <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                      <span>Protection des Administrateurs Garantie</span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Les comptes dotés des rôles <strong>admin</strong>, <strong>admin_manager</strong> et le compte racine <strong>admin_first</strong> sont <u>strictement exclus</u> et resteront toujours actifs et sécurisés.
                    </p>
                  </div>
                )}

                {/* 3D Recessed Target Preview Card */}
                {confirmModal.targetUser && confirmModal.type !== 'bulk_status_toggle' && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 text-left shadow-inner">
                    <div className="w-10 h-10 rounded-xl bg-blue-100/70 border border-blue-200 text-[#1877f2] font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                      {confirmModal.targetUser.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-slate-900 truncate">{confirmModal.targetUser.email}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[confirmModal.targetUser.prenom, confirmModal.targetUser.nom].filter(Boolean).join(' ') || `ID #${confirmModal.targetUser.id}`} • <span className="font-semibold text-[#1877f2] capitalize">{confirmModal.targetUser.role}</span>
                      </p>
                    </div>
                  </div>
                )}

                {confirmModal.targetTitle && !confirmModal.targetUser && confirmModal.type !== 'bulk_status_toggle' && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-left shadow-inner">
                    <p className="font-bold text-xs text-slate-900 truncate">{confirmModal.targetTitle}</p>
                    <p className="text-[11px] text-slate-500">ID #{confirmModal.targetId}</p>
                  </div>
                )}

                {/* Impact Warning */}
                {((confirmModal.type === 'status_toggle' || confirmModal.type === 'bulk_status_toggle') && !confirmModal.targetNewStatus) && (
                  <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-800 text-[11px] text-left flex items-start gap-2">
                    <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <p className="leading-snug">
                      {confirmModal.type === 'bulk_status_toggle'
                        ? "Tous les utilisateurs non-administrateurs ne pourront plus se connecter. Un écran les orientant vers contact@eschola.pro leur sera affiché."
                        : "L'utilisateur ne pourra plus s'authentifier. Un message l'orientant vers contact@eschola.pro lui sera présenté."}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={confirmModal.isProcessing}
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-2xl font-bold border border-slate-300 transition-all text-xs cursor-pointer shadow-xs"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={confirmModal.isProcessing}
                    onClick={handleExecuteConfirmAction}
                    className={`w-1/2 py-3 active:scale-[0.98] text-white rounded-2xl font-extrabold transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                      confirmModal.type === 'bulk_status_toggle' || confirmModal.type === 'status_toggle'
                        ? confirmModal.targetNewStatus
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-500/25'
                          : 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 shadow-rose-500/25'
                        : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-500/25'
                    }`}
                  >
                    {confirmModal.isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    <span>
                      {confirmModal.type === 'bulk_status_toggle'
                        ? confirmModal.targetNewStatus
                          ? "⚡ Confirmer l'activation globale"
                          : "🔒 Confirmer la suspension globale"
                        : confirmModal.type === 'status_toggle'
                          ? confirmModal.targetNewStatus
                            ? "Confirmer l'activation"
                            : "Confirmer la suspension"
                          : "Confirmer la suppression"}
                    </span>
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
