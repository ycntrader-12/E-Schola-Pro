'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  BookOpen,
  Award,
  Video,
  Settings,
  Activity,
  FileText,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  Key,
  Lock,
  Unlock,
  Laptop,
  Mail,
  Send,
  UserPlus,
  UserX,
  UserCheck,
  Server,
  Database,
  Sliders,
  ExternalLink,
  ChevronRight,
  Eye,
  LogOut,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Zap
} from 'lucide-react';
import { apiClient } from '@/lib/api';

const ADMIN_ROLES = ['admin', 'admin_manager'];

export default function AdminConsolePage() {
  const router = useRouter();

  // Auth & Permissions
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'rbac' | 'audit' | 'sessions' | 'invitations' | 'classrooms' | 'quizzes' | 'settings' | 'system' | 'logs_backup'
  >('overview');

  // Real Data States
  const [stats, setStats] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [platformSettings, setPlatformSettings] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [appLogs, setAppLogs] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [quizzesData, setQuizzesData] = useState<any>(null);

  // Filter & Search states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // Modals
  const [selectedAuditLog, setSelectedAuditLog] = useState<any>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('étudiant');
  const [inviteGroup, setInviteGroup] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settings editing state
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const loadAllData = async () => {
    setRefreshing(true);
    try {
      const [
        statsRes,
        usersRes,
        auditRes,
        sessionsRes,
        secRes,
        invitesRes,
        settingsRes,
        sysRes,
        logsRes,
        roomsRes,
        quizRes
      ] = await Promise.all([
        apiClient.get('/admin/dashboard/stats').catch(() => ({ data: null })),
        apiClient.get('/users/').catch(() => ({ data: [] })),
        apiClient.get(`/admin/audit-logs?page=${auditPage}&limit=40`).catch(() => ({ data: { items: [], total: 0 } })),
        apiClient.get('/admin/sessions').catch(() => ({ data: [] })),
        apiClient.get('/admin/security/events').catch(() => ({ data: null })),
        apiClient.get('/admin/invitations').catch(() => ({ data: [] })),
        apiClient.get('/admin/settings').catch(() => ({ data: [] })),
        apiClient.get('/admin/system/status').catch(() => ({ data: null })),
        apiClient.get('/admin/system/logs?limit=50').catch(() => ({ data: [] })),
        apiClient.get('/admin/classrooms/supervision').catch(() => ({ data: [] })),
        apiClient.get('/admin/quizzes/supervision').catch(() => ({ data: null }))
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (Array.isArray(usersRes.data)) setAllUsers(usersRes.data);
      if (auditRes.data) {
        setAuditLogs(auditRes.data.items || []);
        setAuditTotal(auditRes.data.total || 0);
      }
      if (Array.isArray(sessionsRes.data)) setActiveSessions(sessionsRes.data);
      if (secRes.data) setSecurityEvents(secRes.data);
      if (Array.isArray(invitesRes.data)) setInvitations(invitesRes.data);
      if (Array.isArray(settingsRes.data)) {
        setPlatformSettings(settingsRes.data);
        const map: Record<string, string> = {};
        settingsRes.data.forEach((s: any) => {
          map[s.key] = s.value;
        });
        setEditingSettings(map);
      }
      if (sysRes.data) setSystemStatus(sysRes.data);
      if (Array.isArray(logsRes.data)) setAppLogs(logsRes.data);
      if (Array.isArray(roomsRes.data)) setClassrooms(roomsRes.data);
      if (quizRes.data) setQuizzesData(quizRes.data);
    } catch (err) {
      console.error('Erreur chargement données admin:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial Load & Auth Check
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        const userRes = await apiClient.get('/users/me');
        const userData = userRes.data;
        setCurrentUser(userData);

        const r = (userData.role || '').trim().toLowerCase();
        if (ADMIN_ROLES.includes(r)) {
          setIsAuthorized(true);
          await loadAllData();
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Actions
  const handleToggleUserStatus = async (userId: number, currentStatus: boolean, userEmail: string) => {
    try {
      await apiClient.put(`/users/${userId}`, { is_active: !currentStatus });
      showNotification('success', `Compte ${userEmail} ${!currentStatus ? 'activé' : 'suspendu'} avec succès.`);
      await loadAllData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Erreur lors du basculement de statut.');
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter immédiatement cette session ?')) return;
    try {
      await apiClient.delete(`/admin/sessions/${sessionId}`);
      showNotification('success', 'Session révoquée avec succès.');
      await loadAllData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Erreur lors de la révocation de session.');
    }
  };

  const handleRevokeAllUserSessions = async (userId: number, userEmail: string) => {
    if (!confirm(`Déconnecter toutes les sessions actives de ${userEmail} ?`)) return;
    try {
      await apiClient.post(`/admin/sessions/revoke-all-user/${userId}`);
      showNotification('success', `Toutes les sessions de ${userEmail} ont été révoquées.`);
      await loadAllData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Erreur.');
    }
  };

  const handleTerminateRoom = async (roomId: number, title: string) => {
    if (!confirm(`Clôturer d'urgence la visioconférence "${title}" ? Les participants seront déconnectés.`)) return;
    try {
      await apiClient.post(`/admin/classrooms/${roomId}/terminate`);
      showNotification('success', `La salle "${title}" a été clôturée avec succès.`);
      await loadAllData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Erreur lors de la fermeture de salle.');
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteSubmitting(true);
    try {
      await apiClient.post('/admin/invitations', {
        email: inviteEmail,
        role: inviteRole,
        group_name: inviteGroup || null,
      });
      showNotification('success', `Invitation envoyée avec succès à ${inviteEmail}.`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteGroup('');
      await loadAllData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || "Échec de l'envoi de l'invitation.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleResendInvitation = async (inviteId: number, email: string) => {
    try {
      await apiClient.post(`/admin/invitations/${inviteId}/resend`);
      showNotification('success', `Invitation renvoyée à ${email}.`);
      await loadAllData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Erreur de renvoi.');
    }
  };

  const handleRevokeInvitation = async (inviteId: number) => {
    if (!confirm('Révoquer cette invitation ?')) return;
    try {
      await apiClient.delete(`/admin/invitations/${inviteId}`);
      showNotification('success', 'Invitation révoquée avec succès.');
      await loadAllData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Erreur.');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.put('/admin/settings', { settings: editingSettings });
      showNotification('success', 'Paramètres système enregistrés et appliqués.');
      await loadAllData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Erreur lors de la mise à jour des paramètres.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await apiClient.get('/admin/backup/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eschola_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', 'Archive de sauvegarde JSON téléchargée avec succès.');
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || "Erreur lors de l'exportation de la sauvegarde.");
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      const res = await apiClient.post('/admin/backup/snapshot');
      showNotification('success', `Instantané créé sur le serveur : ${res.data.filename} (${res.data.size_kb} Ko).`);
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || "Erreur lors de la création de l'instantané.");
    }
  };

  // Export Users CSV
  const handleExportUsersCSV = () => {
    if (!allUsers || allUsers.length === 0) return;
    const headers = ['ID', 'Email', 'Nom', 'Prenom', 'Role', 'Departement', 'Statut'];
    const rows = filteredUsers.map(u => [
      u.id,
      `"${u.email || ''}"`,
      `"${u.nom || ''}"`,
      `"${u.prenom || ''}"`,
      `"${u.role || ''}"`,
      `"${u.departement || ''}"`,
      u.is_active !== false ? 'Actif' : 'Suspendu',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `utilisateurs_eschola_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      const term = userSearch.toLowerCase().trim();
      const matchSearch =
        !term ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.nom || '').toLowerCase().includes(term) ||
        (u.prenom || '').toLowerCase().includes(term) ||
        (u.username || '').toLowerCase().includes(term);

      const matchRole = userRoleFilter === 'all' || (u.role || '').toLowerCase() === userRoleFilter.toLowerCase();
      const matchStatus =
        userStatusFilter === 'all' ||
        (userStatusFilter === 'active' && u.is_active !== false) ||
        (userStatusFilter === 'disabled' && u.is_active === false);

      return matchSearch && matchRole && matchStatus;
    });
  }, [allUsers, userSearch, userRoleFilter, userStatusFilter]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#1877f2] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-semibold text-sm">Chargement de la Console d'Administration...</p>
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Accès Administrateur Restreint</h1>
            <p className="text-sm text-slate-600 mt-2">
              Cette console est strictement réservée aux administrateurs autorisés (rôles <strong>admin</strong> et <strong>admin_manager</strong>).
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-[#1877f2] text-white font-bold text-sm shadow-md hover:bg-[#166fe5] transition-all"
          >
            Retourner au Tableau de Bord
          </Link>
        </div>
      </div>
    );
  }

  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Banner Header */}
      <header className="bg-[#16325c] text-white border-b border-[#1e3a66] shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#1877f2] flex items-center justify-center shadow-md shadow-blue-500/20 text-white shrink-0">
                <ShieldCheck size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-white">
                    Console d'Administration &amp; Gouvernance
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-200 border border-blue-400/30">
                    {isSuperAdmin ? 'Super Admin Racine' : 'Admin Manager'}
                  </span>
                </div>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  Supervision en direct, sécurité, utilisateurs, RBAC et infrastructure E-Schola Pro
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* DB Status Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold">
                <div className={`w-2 h-2 rounded-full ${stats?.system?.database_alive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>Moteur: {stats?.system?.database_engine || 'DB'} ({stats?.system?.database_latency_ms || 0}ms)</span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={loadAllData}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                title="Actualiser les données"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>

              {/* Return to Dashboard */}
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold transition-all shadow-sm"
              >
                <span>Dashboard</span> &rarr;
              </Link>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
            {[
              { id: 'overview', label: "Vue d'Ensemble", icon: Activity },
              { id: 'users', label: `Utilisateurs (${allUsers.length})`, icon: Users },
              { id: 'rbac', label: 'Rôles & RBAC', icon: Shield },
              { id: 'audit', label: `Audit Log (${auditTotal})`, icon: FileText },
              { id: 'sessions', label: `Sessions (${activeSessions.length})`, icon: Laptop },
              { id: 'invitations', label: `Invitations (${invitations.length})`, icon: Mail },
              { id: 'classrooms', label: `Visioconférence (${classrooms.length})`, icon: Video },
              { id: 'quizzes', label: 'Quiz & Résultats', icon: Award },
              { id: 'settings', label: 'Paramètres', icon: Settings },
              { id: 'system', label: 'Santé Système', icon: Server },
              { id: 'logs_backup', label: 'Logs & Backups', icon: Database },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#1877f2] text-white shadow-md font-extrabold'
                      : 'text-blue-100/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-bold border transition-all ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{feedbackMessage.text}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-700">
              &times;
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1 : VUE D'ENSEMBLE & MÉTRIQUES                                        */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Utilisateurs Inscrits</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.users?.total || allUsers.length}</h3>
                  <p className="text-xs text-emerald-600 font-semibold mt-1">
                    {stats?.users?.active || 0} actifs • {stats?.users?.disabled || 0} suspendus
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1877f2] flex items-center justify-center">
                  <Users size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cours &amp; Vidéos</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.academics?.courses || 0}</h3>
                  <p className="text-xs text-slate-600 font-semibold mt-1">
                    {stats?.academics?.videos || 0} vidéos • {stats?.academics?.enrollments || 0} inscriptions
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Évaluations &amp; Quiz</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.quizzes?.total || 0}</h3>
                  <p className="text-xs text-amber-600 font-semibold mt-1">
                    {stats?.quizzes?.attempts || 0} tentatives • Moyenne {stats?.quizzes?.average_score || 0}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Award size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Salles Vidéo Live</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.classrooms?.active || 0}</h3>
                  <p className="text-xs text-purple-600 font-semibold mt-1">
                    {stats?.classrooms?.total || 0} salles créées • {stats?.classrooms?.invitations || 0} invites
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Video size={24} />
                </div>
              </div>
            </div>

            {/* Middle Grid: Roles distribution & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Distribution des Rôles */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Shield size={18} className="text-[#1877f2]" /> Répartition par Rôles
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">RBAC E-Schola Pro</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {Object.entries(stats?.users?.by_role || {}).map(([roleName, count]: [string, any]) => (
                    <div key={roleName} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 capitalize">{roleName}</p>
                      <p className="text-xl font-black text-[#16325c] mt-1">{count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raccourcis d'actions rapides */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" /> Actions Immédiates
                </h3>
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 text-[#1877f2] font-bold text-xs hover:bg-blue-100 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Send size={15} /> Inviter un utilisateur
                    </span>
                    <ChevronRight size={15} />
                  </button>

                  <button
                    onClick={handleDownloadBackup}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Download size={15} /> Exporter sauvegarde JSON
                    </span>
                    <ChevronRight size={15} />
                  </button>

                  <button
                    onClick={() => setActiveTab('audit')}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={15} /> Consulter le journal d'audit
                    </span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2 : GESTION COMPLÈTE DES UTILISATEURS                                  */}
        {/* ========================================================================= */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Annuaire &amp; Gestion des Comptes</h3>
                <p className="text-xs text-slate-500">Filtrage, gestion des statuts, réinitialisation et export</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportUsersCSV}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
                >
                  <Download size={15} /> Exporter CSV ({filteredUsers.length})
                </button>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1877f2] text-white hover:bg-[#166fe5] text-xs font-bold transition-all shadow-sm"
                >
                  <Plus size={15} /> Nouvelle Invitation
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email, username..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1877f2] focus:outline-none"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-[#1877f2] focus:outline-none"
              >
                <option value="all">Tous les Rôles ({allUsers.length})</option>
                <option value="étudiant">Étudiants</option>
                <option value="formateur">Formateurs</option>
                <option value="pedagogique">Pédagogique</option>
                <option value="dg_rh">DG / RH</option>
                <option value="stagiaire">Stagiaires</option>
                <option value="employer">Employés</option>
                <option value="admin_manager">Admin Managers</option>
                <option value="admin">Super Administrateurs</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={e => setUserStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-[#1877f2] focus:outline-none"
              >
                <option value="all">Tous les Statuts</option>
                <option value="active">Actifs Uniquement</option>
                <option value="disabled">Suspendus Uniquement</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Rôle</th>
                    <th className="px-4 py-3">Département</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">
                        Aucun utilisateur ne correspond aux critères.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.slice(0, 50).map(u => {
                      const isRoot = (u.username || '').toLowerCase() === 'admin_first';
                      const isActive = u.is_active !== false;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">
                              {u.prenom} {u.nom}
                            </div>
                            <div className="text-slate-500 text-[11px]">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                                u.role === 'admin'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : u.role === 'admin_manager'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : u.role === 'formateur'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-blue-50 text-[#1877f2] border border-blue-200'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{u.departement || '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {isActive ? 'Actif' : 'Suspendu'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              {!isRoot && (
                                <button
                                  onClick={() => handleToggleUserStatus(u.id, isActive, u.email)}
                                  className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                    isActive
                                      ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={isActive ? 'Suspendre ce compte' : 'Activer ce compte'}
                                >
                                  {isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                                </button>
                              )}
                              <button
                                onClick={() => handleRevokeAllUserSessions(u.id, u.email)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Déconnecter toutes les sessions de cet utilisateur"
                              >
                                <LogOut size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3 : RÔLES & CONTRÔLE RBAC                                             */}
        {/* ========================================================================= */}
        {activeTab === 'rbac' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Matrice des Permissions &amp; Sécurité RBAC</h3>
              <p className="text-xs text-slate-500">
                Contrôle d'accès basé sur les rôles (Role-Based Access Control) appliqué sur toute l'API
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Rôle Officiel</th>
                    <th className="px-4 py-3">Niveau d'Accès</th>
                    <th className="px-4 py-3">Gestion Utilisateurs</th>
                    <th className="px-4 py-3">Gestion Cours/Quiz</th>
                    <th className="px-4 py-3">Supervision BD &amp; Backups</th>
                    <th className="px-4 py-3">Visioconférence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-extrabold text-rose-700">admin (Super Admin)</td>
                    <td className="px-4 py-3 font-semibold">Accès Total Illimité</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Complet</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Complet</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Exclusif</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Modération Live</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-extrabold text-amber-700">admin_manager</td>
                    <td className="px-4 py-3 font-semibold">Gestionnaire</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Non-Admins</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Complet</td>
                    <td className="px-4 py-3 text-slate-400 font-bold">✗ Verrouillé</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Modération Live</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-extrabold text-purple-700">formateur</td>
                    <td className="px-4 py-3 font-semibold">Enseignant / Mentor</td>
                    <td className="px-4 py-3 text-slate-400 font-bold">✗ Verrouillé</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Ses cours &amp; quiz</td>
                    <td className="px-4 py-3 text-slate-400 font-bold">✗ Verrouillé</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">✓ Animateur</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-extrabold text-blue-700">étudiant / stagiaire / employer</td>
                    <td className="px-4 py-3 font-semibold">Apprenant</td>
                    <td className="px-4 py-3 text-slate-400 font-bold">✗ Verrouillé</td>
                    <td className="px-4 py-3 text-blue-600 font-bold">Lecture &amp; Soumissions</td>
                    <td className="px-4 py-3 text-slate-400 font-bold">✗ Verrouillé</td>
                    <td className="px-4 py-3 text-blue-600 font-bold">Participant</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Root Protection Notice */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs">
              <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Protection Immuable du Super-Administrateur Racine :</p>
                <p className="mt-0.5 text-amber-800">
                  Le compte système racine <code>admin_first</code> (email: <code>admin_first@eschola.pro</code>) bénéficie d'une protection cryptographique absolue. Il ne peut être ni suspendu, ni altéré, ni supprimé par un autre administrateur.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4 : JOURNAL D'AUDIT (AUDIT LOGS)                                      */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Journal d'Audit &amp; Traçabilité</h3>
                <p className="text-xs text-slate-500">Historique horodaté des actions et authentifications</p>
              </div>
              <span className="text-xs font-bold text-slate-500">{auditTotal} événements enregistrés</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">Date / Heure</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Acteur</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Aucun événement d'audit enregistré.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {l.created_at ? l.created_at.slice(0, 19).replace('T', ' ') : '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{l.action}</td>
                        <td className="px-4 py-3 text-slate-600">{l.user_email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              l.status === 'SUCCESS'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{l.ip_address}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedAuditLog(l)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                            title="Voir les détails complets"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5 : SESSIONS ACTIVES                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'sessions' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Sessions Actives Connectées</h3>
                <p className="text-xs text-slate-500">Supervision des terminaux et révocation immédiate</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-blue-50 text-[#1877f2] text-xs font-extrabold">
                {activeSessions.length} sessions actives
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Appareil / Navigateur</th>
                    <th className="px-4 py-3">Adresse IP</th>
                    <th className="px-4 py-3">Dernière Activité</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">
                        Aucune session active enregistrée.
                      </td>
                    </tr>
                  ) : (
                    activeSessions.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{s.user_name}</div>
                          <div className="text-slate-500 text-[11px]">{s.user_email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-semibold">{s.device_info}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{s.ip_address}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {s.last_activity ? s.last_activity.slice(0, 19).replace('T', ' ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRevokeSession(s.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-colors"
                          >
                            Révoquer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6 : INVITATIONS UTILISATEURS                                          */}
        {/* ========================================================================= */}
        {activeTab === 'invitations' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Invitations Envoyées</h3>
                <p className="text-xs text-slate-500">Suivi des liens d'invitation et statuts</p>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1877f2] text-white hover:bg-[#166fe5] text-xs font-bold transition-all shadow-sm"
              >
                <Plus size={15} /> Envoyer une Invitation
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">Email Destinataire</th>
                    <th className="px-4 py-3">Rôle Prévu</th>
                    <th className="px-4 py-3">Groupe</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Date Expiration</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Aucune invitation en cours.
                      </td>
                    </tr>
                  ) : (
                    invitations.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{inv.email}</td>
                        <td className="px-4 py-3 capitalize font-semibold">{inv.role}</td>
                        <td className="px-4 py-3 text-slate-600">{inv.group_name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              inv.status === 'pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : inv.status === 'accepted'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {inv.status === 'pending' ? 'En attente' : inv.status === 'accepted' ? 'Acceptée' : inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px] font-mono">
                          {inv.expires_at ? inv.expires_at.slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            {inv.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleResendInvitation(inv.id, inv.email)}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                                  title="Renvoyer l'email"
                                >
                                  <RefreshCw size={14} />
                                </button>
                                <button
                                  onClick={() => handleRevokeInvitation(inv.id)}
                                  className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                                  title="Révoquer l'invitation"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7 : VISIOCONFÉRENCES                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'classrooms' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Supervision des Salles Vidéo Conférence</h3>
                <p className="text-xs text-slate-500">Modération en direct et arrêt d'urgence des salles</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-700 text-xs font-extrabold">
                {classrooms.filter(c => c.is_active).length} en direct
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classrooms.map(c => (
                <div
                  key={c.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    c.is_active
                      ? 'bg-white border-emerald-300 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-400/20'
                      : 'bg-slate-50 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        c.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${c.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {c.is_active ? 'En Direct' : 'Clôturée'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">#{c.room_id}</span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-sm line-clamp-1">{c.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">Créée par : {c.instructor_email}</p>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">{c.invitations_count} invités</span>
                    {c.is_active && (
                      <button
                        onClick={() => handleTerminateRoom(c.id, c.title)}
                        className="px-3 py-1 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-colors"
                      >
                        Arrêt d'urgence
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8 : QUIZ & RÉSULTATS                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'quizzes' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Supervision des Quiz &amp; Résultats</h3>
              <p className="text-xs text-slate-500">Taux de complétion et dernières tentatives enregistrées</p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">Titre du Quiz</th>
                    <th className="px-4 py-3">Formateur</th>
                    <th className="px-4 py-3">Questions</th>
                    <th className="px-4 py-3">Tentatives</th>
                    <th className="px-4 py-3">Moyenne Globale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quizzesData?.quizzes?.map((q: any) => (
                    <tr key={q.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{q.title}</td>
                      <td className="px-4 py-3 text-slate-600">{q.creator_email}</td>
                      <td className="px-4 py-3 font-semibold">{q.questions_count} questions</td>
                      <td className="px-4 py-3 font-bold text-[#1877f2]">{q.attempts_count}</td>
                      <td className="px-4 py-3 font-extrabold text-slate-900">{q.average_score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 9 : PARAMÈTRES GLOBAUX DE LA PLATEFORME                               */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Configuration de la Plateforme</h3>
                <p className="text-xs text-slate-500">Paramètres persistés en base de données et appliqués instantanément</p>
              </div>
              {isSuperAdmin && (
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-5 py-2.5 rounded-xl bg-[#1877f2] text-white hover:bg-[#166fe5] text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {savingSettings ? 'Enregistrement...' : 'Enregistrer les Modifications'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {platformSettings.map(s => (
                <div key={s.key} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">{s.key}</label>
                  <p className="text-[11px] text-slate-500">{s.description}</p>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={editingSettings[s.key] ?? s.value}
                    onChange={e => setEditingSettings({ ...editingSettings, [s.key]: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#1877f2] focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 10 : SANTÉ SYSTÈME & INFRASTRUCTURE                                   */}
        {/* ========================================================================= */}
        {activeTab === 'system' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Infrastructure &amp; État des Services</h3>
              <p className="text-xs text-slate-500">Diagnostic en temps réel pour l'hébergement Railway et production</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Moteur Base de Données</p>
                <h4 className="text-xl font-black text-slate-900 capitalize">{systemStatus?.database?.engine || 'SQL'}</h4>
                <p className="text-xs text-emerald-600 font-semibold">Latence ping : {systemStatus?.database?.latency_ms || 0} ms</p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Stockage Uploads</p>
                <h4 className="text-xl font-black text-slate-900">{systemStatus?.storage?.uploads_size_mb || 0} Mo</h4>
                <p className="text-xs text-slate-600 font-medium">{systemStatus?.storage?.uploads_file_count || 0} fichiers stockés</p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Temps de Fonctionnement</p>
                <h4 className="text-xl font-black text-slate-900">{systemStatus?.system?.uptime_formatted || '0h 0m'}</h4>
                <p className="text-xs text-blue-600 font-semibold">Environnement : {systemStatus?.system?.environment || 'dev'}</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 11 : LOGS SÉCURISÉS & SAUVEGARDES                                      */}
        {/* ========================================================================= */}
        {activeTab === 'logs_backup' && (
          <div className="space-y-6">
            {/* Sauvegardes Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Sauvegardes &amp; Restauration de la Base de Données</h3>
                <p className="text-xs text-slate-500">
                  Exportation intégrale des tables et création d'instantanés garantissant la persistance sur Railway
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap pt-2">
                <button
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Download size={16} /> Télécharger l'Archive JSON Complète
                </button>

                <button
                  onClick={handleCreateSnapshot}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
                >
                  <Database size={16} /> Générer Instantané Serveur
                </button>
              </div>
            </div>

            {/* Logs Console */}
            <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-xl space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Console des Logs Applicatifs Sécurisés</h4>
                </div>
                <span className="text-[10px] text-slate-400">Masquage automatique des secrets activé</span>
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto text-[11px] pr-2 scrollbar-none">
                {appLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-1 border-b border-slate-800/50 hover:bg-slate-800/40 px-2 rounded">
                    <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                    <span
                      className={`font-bold shrink-0 ${
                        log.level === 'INFO'
                          ? 'text-emerald-400'
                          : log.level === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-blue-300 font-bold shrink-0">{log.action}</span>
                    <span className="text-slate-400 truncate">{log.details}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL INVITATION                                                          */}
      {/* ========================================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-zoom-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1877f2] flex items-center justify-center">
                  <Send size={18} />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Inviter un Nouvel Utilisateur</h3>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleSendInvitation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Destinataire *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1877f2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rôle Attribué *</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-[#1877f2] focus:outline-none"
                >
                  <option value="étudiant">Étudiant</option>
                  <option value="formateur">Formateur</option>
                  <option value="pedagogique">Pédagogique</option>
                  <option value="dg_rh">DG / RH</option>
                  <option value="stagiaire">Stagiaire</option>
                  <option value="employer">Employé</option>
                  <option value="admin_manager">Admin Manager</option>
                  {isSuperAdmin && <option value="admin">Super Admin</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Groupe / Promotion (Optionnel)</label>
                <input
                  type="text"
                  value={inviteGroup}
                  onChange={e => setInviteGroup(e.target.value)}
                  placeholder="Ex: Groupe A - Master Dev"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1877f2] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                >
                  {inviteSubmitting ? 'Envoi...' : "Envoyer l'Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DÉTAILS AUDIT LOG                                                   */}
      {/* ========================================================================= */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-zoom-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <FileText size={16} className="text-[#1877f2]" /> Détail de l'Événement d'Audit #{selectedAuditLog.id}
              </h3>
              <button onClick={() => setSelectedAuditLog(null)} className="text-slate-400 hover:text-slate-700 text-lg">
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Action :</span>
                <span className="font-bold text-slate-900">{selectedAuditLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Acteur :</span>
                <span className="font-bold text-slate-900">{selectedAuditLog.user_email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Adresse IP :</span>
                <span className="font-mono text-slate-900">{selectedAuditLog.ip_address}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Date &amp; Heure :</span>
                <span className="font-mono text-slate-900">{selectedAuditLog.created_at}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Détails :</span>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-800 whitespace-pre-wrap break-all">
                  {selectedAuditLog.details || 'Aucun détail supplémentaire.'}
                </pre>
              </div>
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
