'use client';

import { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Calendar, 
  Filter, 
  Save, 
  Trash2, 
  Search, 
  Loader2, 
  Sparkles, 
  Users, 
  ArrowLeft,
  Plus,
  ChevronDown,
  Layers,
  GraduationCap,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { apiClient } from '@/lib/api';

interface Learner {
  id: number;
  email: string;
  role: string;
  group_name?: string;
}

interface AttendanceRecord {
  id: number;
  user_id: number;
  marked_by_id?: number;
  date: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  minutes_late: number;
  session_name: string;
  remarks?: string;
  created_at: string;
  user?: { id: number; email: string; role: string };
  marked_by?: { id: number; email: string; role: string };
}

interface GlobalOverview {
  total_records: number;
  total_students: number;
  today_present: number;
  today_late: number;
  today_absent: number;
  today_attendance_rate: number;
  monthly_attendance_rate: number;
}

interface PeriodStats {
  period_name: string;
  total_sessions: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendance_rate: number;
  quiz_points: number;
  quiz_average_note: number;
  quizzes_taken: number;
  quiz_success_rate: number;
}

interface DashboardPerformance {
  user_id: number;
  user_email: string;
  user_role: string;
  daily: PeriodStats;
  monthly: PeriodStats;
  semester: PeriodStats;
  overall: PeriodStats;
  recent_attendances: AttendanceRecord[];
}

export default function AttendancePage() {
  const t = useTranslations('Attendance');
  const tCommon = useTranslations('Common');
  const tRoles = useTranslations('Roles');
  const tNav = useTranslations('Navigation');
  const locale = useLocale();

  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string; group_name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Manager data
  const [learners, setLearners] = useState<Learner[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [overview, setOverview] = useState<GlobalOverview | null>(null);

  // Learner data (étudiant, stagiaire, employer)
  const [myStats, setMyStats] = useState<DashboardPerformance | null>(null);
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [selectedPeriodTab, setSelectedPeriodTab] = useState<'overall' | 'semester' | 'monthly' | 'daily'>('overall');
  const [mySearchQuery, setMySearchQuery] = useState('');
  const [myStatusFilter, setMyStatusFilter] = useState('');
  const [myDateFilter, setMyDateFilter] = useState('');

  // Roll call form state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessionName, setSessionName] = useState<string>('Cours Magistral / Session Pratique');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [rollCallState, setRollCallState] = useState<{
    [userId: number]: {
      status: 'present' | 'late' | 'absent' | 'excused';
      minutes_late: number;
      remarks: string;
    };
  }>({});

  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  // Add Learner Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('étudiant');
  const [newGroup, setNewGroup] = useState('Groupe A - Informatique & IA');
  const [isAddingLearner, setIsAddingLearner] = useState(false);

  const isManager = currentUser?.role === 'formateur' || currentUser?.role === 'admin';

  // 1. Fetch current user, learners, groups & history
  const fetchData = async () => {
    try {
      const userRes = await apiClient.get('/users/me');
      setCurrentUser(userRes.data);

      if (userRes.data.role === 'formateur' || userRes.data.role === 'admin') {
        const [learnersRes, groupsRes, historyRes, overviewRes] = await Promise.all([
          apiClient.get('/attendance/learners'),
          apiClient.get('/attendance/groups').catch(() => ({ data: [] })),
          apiClient.get('/attendance/'),
          apiClient.get('/attendance/overview')
        ]);

        setLearners(learnersRes.data);
        setGroups(groupsRes.data || []);
        setHistoryRecords(historyRes.data);
        setOverview(overviewRes.data);

        // Pre-populate roll call state
        const initialRollCall: any = {};
        learnersRes.data.forEach((l: Learner) => {
          const existing = historyRes.data.find(
            (r: AttendanceRecord) => r.user_id === l.id && r.date === selectedDate
          );
          if (existing) {
            initialRollCall[l.id] = {
              status: existing.status,
              minutes_late: existing.minutes_late || 0,
              remarks: existing.remarks || ''
            };
          } else {
            initialRollCall[l.id] = {
              status: 'present',
              minutes_late: 0,
              remarks: ''
            };
          }
        });
        setRollCallState(initialRollCall);
      } else {
        // Fetch personal stats and records for learner
        const [statsRes, recordsRes] = await Promise.all([
          apiClient.get('/attendance/my-stats'),
          apiClient.get('/attendance/my-records').catch(() => ({ data: [] }))
        ]);
        setMyStats(statsRes.data);
        setMyRecords(recordsRes.data && recordsRes.data.length > 0 ? recordsRes.data : statsRes.data.recent_attendances || []);
      }
    } catch (err) {
      console.error('Error fetching attendance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update roll call when date changes
  useEffect(() => {
    if (!learners.length) return;
    const updated: any = {};
    learners.forEach((l) => {
      const existing = historyRecords.find(
        (r) => r.user_id === l.id && r.date === selectedDate
      );
      if (existing) {
        updated[l.id] = {
          status: existing.status,
          minutes_late: existing.minutes_late || 0,
          remarks: existing.remarks || ''
        };
      } else {
        updated[l.id] = {
          status: 'present',
          minutes_late: 0,
          remarks: ''
        };
      }
    });
    setRollCallState(updated);
  }, [selectedDate, historyRecords, learners]);

  // Mark all currently visible learners as present
  const handleMarkAllPresent = () => {
    const updated = { ...rollCallState };
    filteredLearners.forEach(l => {
      updated[l.id] = {
        status: 'present',
        minutes_late: 0,
        remarks: rollCallState[l.id]?.remarks || ''
      };
    });
    setRollCallState(updated);
  };

  // Submit Roll Call Batch
  const handleSaveRollCall = async () => {
    setIsSavingBatch(true);
    try {
      const recordsToSubmit = filteredLearners.map(l => {
        const state = rollCallState[l.id] || { status: 'present', minutes_late: 0, remarks: '' };
        return {
          user_id: l.id,
          status: state.status,
          minutes_late: state.status === 'late' ? state.minutes_late : 0,
          remarks: state.remarks || undefined
        };
      });

      await apiClient.post('/attendance/batch', {
        date: selectedDate,
        session_name: sessionName.trim() || 'Session Principale',
        records: recordsToSubmit
      });

      alert(`Émargement validé avec succès pour ${recordsToSubmit.length} apprenant(s) !`);
      
      // Refresh history & overview
      const [historyRes, overviewRes] = await Promise.all([
        apiClient.get('/attendance/'),
        apiClient.get('/attendance/overview')
      ]);
      setHistoryRecords(historyRes.data);
      setOverview(overviewRes.data);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de l'enregistrement de l'émargement.");
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Add Learner to Group
  const handleAddLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsAddingLearner(true);
    try {
      const res = await apiClient.post('/attendance/learners', {
        email: newEmail.trim(),
        role: newRole,
        group_name: newGroup.trim()
      });

      // Update learners state
      setLearners(prev => {
        const idx = prev.findIndex(l => l.id === res.data.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = res.data;
          return cp;
        }
        return [...prev, res.data];
      });

      // Update groups list if new
      if (!groups.includes(newGroup.trim())) {
        setGroups(prev => [...prev, newGroup.trim()]);
      }

      // Pre-populate roll call state for new learner
      setRollCallState(prev => ({
        ...prev,
        [res.data.id]: { status: 'present', minutes_late: 0, remarks: '' }
      }));

      setShowAddModal(false);
      setNewEmail('');
      alert(`Apprenant ${res.data.email} ajouté au ${newGroup} !`);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de l'ajout.");
    } finally {
      setIsAddingLearner(false);
    }
  };

  // Delete an attendance record
  const handleDeleteRecord = async (id: number) => {
    if (!confirm('Supprimer cet enregistrement de présence ?')) return;
    try {
      await apiClient.delete(`/attendance/${id}`);
      setHistoryRecords(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la suppression.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1877f2]" size={32} />
      </div>
    );
  }

  // =========================================================================
  // VIEW FOR LEARNERS (ÉTUDIANT, STAGIAIRE, EMPLOYER)
  // Bilan d'engagement personnel & Tableau de bord d'assiduité individuel
  // =========================================================================
  if (!isManager) {
    const activeStats = myStats ? myStats[selectedPeriodTab] : null;
    const rate = activeStats?.attendance_rate ?? 100;

    // Filter personal records
    const filteredMyRecords = myRecords.filter(r => {
      if (myDateFilter && r.date !== myDateFilter) return false;
      if (myStatusFilter && r.status !== myStatusFilter) return false;
      if (mySearchQuery) {
        const query = mySearchQuery.toLowerCase();
        const session = (r.session_name || '').toLowerCase();
        const remarks = (r.remarks || '').toLowerCase();
        if (!session.includes(query) && !remarks.includes(query)) return false;
      }
      return true;
    });

    const getRateStatus = (val: number) => {
      if (val >= 90) return { label: 'Assiduité Exemplaire', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500' };
      if (val >= 75) return { label: 'Bon Engagement', color: 'text-blue-600 bg-blue-50 border-blue-200', bar: 'bg-blue-600' };
      if (val >= 60) return { label: 'Attention Requise', color: 'text-amber-600 bg-amber-50 border-amber-200', bar: 'bg-amber-500' };
      return { label: 'Risque de Non-Validation', color: 'text-rose-600 bg-rose-50 border-rose-200', bar: 'bg-rose-500' };
    };

    const statusBadge = getRateStatus(rate);

    return (
      <div className="min-h-screen pt-28 pb-20 px-4 max-w-7xl mx-auto space-y-8 select-none">
        
        {/* 1. Header Hero Personnel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#1877f2] border border-blue-200 mb-2.5">
              <UserCheck size={14} />
              <span>{t('page_sub_learner')}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {t('page_title_learner')}
            </h1>
            <p className="text-slate-600 text-sm max-w-2xl mt-1">
              {t('cert_sub')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {(currentUser?.role === 'admin' || currentUser?.role === 'formateur' || currentUser?.role === 'pedagogique') && (
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                title="Exporter au format PDF"
              >
                <Download size={14} />
                <span>Exporter en PDF</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <span>{t('print_sheet')}</span>
            </button>

            <Link
              href="/dashboard"
              className="px-4 py-2.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>{tNav('dashboard')}</span>
            </Link>
          </div>
        </div>

        {/* 2. User Profile Card & Info */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1877f2] text-white flex items-center justify-center font-black text-lg uppercase shadow-sm">
              {currentUser?.email.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-extrabold text-base text-slate-900">{currentUser?.email}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-[#1877f2] border border-blue-200">
                  {currentUser?.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                <span>Groupe : <strong className="text-slate-800">{currentUser?.group_name || 'Groupe A - Informatique & IA'}</strong></span>
                <span>•</span>
                <span>ID #{currentUser?.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
            <div className={`px-4 py-2 rounded-xl text-xs font-extrabold border ${statusBadge.color} flex items-center gap-2`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <span>{statusBadge.label}</span>
            </div>
          </div>
        </div>

        {/* 3. Analysis Period Tabs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Calendar size={14} className="text-[#1877f2]" />
              <span>{t('select_group')} / {tCommon('filter')} :</span>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {[
              { key: 'overall', label: t('period_overall') },
              { key: 'semester', label: t('period_semester') },
              { key: 'monthly', label: t('period_monthly') },
              { key: 'daily', label: t('period_daily') },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedPeriodTab(tab.key as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 text-left cursor-pointer ${
                  selectedPeriodTab === tab.key
                    ? 'bg-[#1877f2] text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <div className="font-extrabold">{tab.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 4. KPI Counters Grid for Selected Period */}
        {activeStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            
            {/* Taux d'assiduité */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm col-span-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">{t('personal_rate')}</span>
                <Sparkles size={16} className="text-[#1877f2]" />
              </div>
              <p className="text-3xl font-black text-slate-900 mt-2">{activeStats.attendance_rate}%</p>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div className={`h-full rounded-full transition-all duration-500 ${statusBadge.bar}`} style={{ width: `${Math.min(activeStats.attendance_rate, 100)}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1.5">
                {activeStats.present + activeStats.late} {t('personal_sessions').toLowerCase()}
              </p>
            </div>

            {/* Présences Confirmées */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">{t('personal_sessions')}</span>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className="text-3xl font-black text-emerald-600 mt-2">{activeStats.present}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">/ {activeStats.total_sessions}</p>
            </div>

            {/* Retards */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">{t('personal_punctuality')}</span>
                <Clock size={16} className="text-amber-500" />
              </div>
              <p className="text-3xl font-black text-amber-500 mt-2">{activeStats.late}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">{t('late')}</p>
            </div>

            {/* Absences */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">{t('personal_absences')}</span>
                <XCircle size={16} className="text-rose-500" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-3xl font-black text-rose-500">{activeStats.absent}</span>
                <span className="text-xs font-bold text-slate-400">/ {activeStats.excused} {t('excused').toLowerCase()}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">{t('absent')}</p>
            </div>

            {/* Note & Quiz */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm col-span-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">{t('personal_quiz')}</span>
                <GraduationCap size={16} className="text-indigo-500" />
              </div>
              <p className="text-3xl font-black text-indigo-600 mt-2">
                {activeStats.quiz_average_note > 0 ? `${activeStats.quiz_average_note}/20` : '—'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                {activeStats.quizzes_taken} test(s) • {activeStats.quiz_success_rate}%
              </p>
            </div>

          </div>
        )}

        {/* 5. Tableau d'Historique Personnel des Émargements */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 space-y-5 shadow-sm">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {t('history_title')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('history_sub')}
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={mySearchQuery}
                  onChange={(e) => setMySearchQuery(e.target.value)}
                  placeholder={tCommon('search')}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1877f2] text-slate-800"
                />
              </div>

              <select
                value={myStatusFilter}
                onChange={(e) => setMyStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1877f2] text-slate-800 cursor-pointer"
              >
                <option value="">{tCommon('all')} {tCommon('status').toLowerCase()}</option>
                <option value="present">{t('present')}</option>
                <option value="late">{t('late')}</option>
                <option value="absent">{t('absent')}</option>
                <option value="excused">{t('excused')}</option>
              </select>

              <input
                type="date"
                value={myDateFilter}
                onChange={(e) => setMyDateFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1877f2] text-slate-800"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
                  <th className="pb-3 px-3">{t('date_session')}</th>
                  <th className="pb-3 px-3">{t('session_name')}</th>
                  <th className="pb-3 px-3">{tCommon('status')}</th>
                  <th className="pb-3 px-3">{t('late')}</th>
                  <th className="pb-3 px-3">Enseignant</th>
                  <th className="pb-3 px-3">{tCommon('details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <CheckCircle2 size={24} className="text-emerald-500/60" />
                        <p className="text-sm font-semibold text-slate-700">{tCommon('none')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMyRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {rec.date}
                      </td>

                      {/* Session Name */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-900">
                          {rec.session_name || 'Cours Magistral'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        {rec.status === 'present' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={13} className="text-emerald-500" />
                            <span>{t('present')}</span>
                          </span>
                        )}
                        {rec.status === 'late' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={13} className="text-amber-500" />
                            <span>{t('late')}</span>
                          </span>
                        )}
                        {rec.status === 'absent' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle size={13} className="text-rose-500" />
                            <span>{t('absent')}</span>
                          </span>
                        )}
                        {rec.status === 'excused' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <ShieldCheck size={13} className="text-blue-500" />
                            <span>{t('excused')}</span>
                          </span>
                        )}
                      </td>

                      {/* Minutes Late */}
                      <td className="py-3.5 px-3">
                        {rec.minutes_late > 0 ? (
                          <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-xs">
                            +{rec.minutes_late} min
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* Marked By */}
                      <td className="py-3.5 px-3">
                        <span className="text-slate-600 text-xs font-medium">
                          {rec.marked_by?.email || 'Formateur Référent'}
                        </span>
                      </td>

                      {/* Remarks */}
                      <td className="py-3.5 px-3">
                        {rec.remarks ? (
                          <span className="text-slate-700 italic bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                            {rec.remarks}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* 6. Certification & Conformité Banner */}
        <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#1877f2] text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              {t('cert_title')}
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              {t('cert_sub')}
            </p>
          </div>
        </div>

      </div>
    );
  }


  // Filtered learners for roll call
  const filteredLearners = learners.filter(l => {
    if (selectedGroup !== 'all' && (l.group_name || 'Groupe A - Informatique & IA') !== selectedGroup) return false;
    if (roleFilter !== 'all' && l.role !== roleFilter) return false;
    if (searchFilter && !l.email.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  // Filtered history records
  const filteredHistory = historyRecords.filter(r => {
    if (historyDateFilter && r.date !== historyDateFilter) return false;
    if (historyStatusFilter && r.status !== historyStatusFilter) return false;
    if (historySearchQuery) {
      const email = r.user?.email || '';
      if (!email.toLowerCase().includes(historySearchQuery.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen pt-28 pb-20 px-4 max-w-7xl mx-auto space-y-8">
      
      {/* 1. Header Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-2">
            <ShieldCheck size={14} />
            <span>GESTION EXCLUSIVE • FORMATEURS & ADMINISTRATEURS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary">
            Feuille d'Émargement & <span className="text-brand-gradient">Suivi des Présences par Groupe</span>
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl mt-1">
            Gérez les listes de présence par groupe ou pour l'ensemble des promotions. Pointez les présences, retards et absences en direct.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={15} />
            <span>Ajouter au Groupe</span>
          </button>

          <Link
            href="/dashboard"
            className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-bold flex items-center gap-2 transition-all w-fit shrink-0"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </div>

      {/* 2. Overview Counters */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-surface border border-border">
            <span className="text-xs text-text-secondary uppercase font-bold">Total Apprenants</span>
            <p className="text-2xl font-black text-primary mt-1">{learners.length}</p>
            <p className="text-[10px] text-text-secondary mt-0.5">Répartis en {groups.length} groupes</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface border border-border">
            <span className="text-xs text-text-secondary uppercase font-bold">Présents Aujourd'hui</span>
            <p className="text-2xl font-black text-emerald-500 mt-1">{overview.today_present}</p>
            <p className="text-[10px] text-text-secondary mt-0.5">Pointés en séance</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface border border-border">
            <span className="text-xs text-text-secondary uppercase font-bold">Retards / Absents</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-500">{overview.today_late}</span>
              <span className="text-xs text-text-secondary">/</span>
              <span className="text-2xl font-black text-rose-500">{overview.today_absent}</span>
            </div>
            <p className="text-[10px] text-text-secondary mt-0.5">Aujourd'hui</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface border border-border">
            <span className="text-xs text-text-secondary uppercase font-bold">Assiduité Globale</span>
            <p className="text-2xl font-black text-secondary mt-1">{overview.monthly_attendance_rate}%</p>
            <p className="text-[10px] text-text-secondary mt-0.5">Moyenne générale</p>
          </div>
        </div>
      )}

      {/* 3. SÉLECTION RAPIDE DES GROUPES / PROMOTIONS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase text-primary tracking-wider flex items-center gap-1.5">
            <Layers size={15} />
            <span>Sélectionner le Groupe pour la Liste de Présence :</span>
          </span>
          <span className="text-xs font-bold text-text-secondary">
            {filteredLearners.length} apprenant(s) affiché(s)
          </span>
        </div>

        {/* Group Badges / Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedGroup('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              selectedGroup === 'all'
                ? 'bg-primary text-white shadow-md shadow-primary/25 ring-2 ring-primary/40'
                : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
            }`}
          >
            <Users size={14} />
            <span>Toute la Liste des Groupes ({learners.length})</span>
          </button>

          {groups.map((grp) => {
            const count = learners.filter(l => (l.group_name || 'Groupe A - Informatique & IA') === grp).length;
            const isSelected = selectedGroup === grp;
            return (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  isSelected
                    ? 'bg-primary text-white shadow-md shadow-primary/25 ring-2 ring-primary/40'
                    : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
                }`}
              >
                <GraduationCap size={14} />
                <span>{grp}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-background text-text-primary'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. SECTION PRINCIPALE : POINTAGE / APPEL EN DIRECT */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-primary/30 space-y-6 shadow-xl">
        
        {/* Barre de configuration d'émargement */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            {/* Date */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-text-secondary mb-1">
                Date de la séance *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs outline-none focus:border-primary text-text-primary"
              />
            </div>

            {/* Session Title */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-text-secondary mb-1">
                Intitulé de la Séance
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Ex: Cours Magistral, TD, Atelier"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs outline-none focus:border-primary text-text-primary"
              />
            </div>

            {/* Public concerné */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-text-secondary mb-1">
                Rôle / Profil
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs outline-none focus:border-primary text-text-primary cursor-pointer"
              >
                <option value="all">Tous les profils</option>
                <option value="étudiant">Étudiants uniquement</option>
                <option value="stagiaire">Stagiaires uniquement</option>
                <option value="employer">Employés uniquement</option>
              </select>
            </div>

            {/* Search learner */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-text-secondary mb-1">
                Rechercher dans le groupe
              </label>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrer par nom ou email..."
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs outline-none focus:border-primary text-text-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-5">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 size={15} className="text-emerald-500" />
              <span>Tout marquer Présent</span>
            </button>

            <button
              type="button"
              onClick={handleSaveRollCall}
              disabled={isSavingBatch}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/25"
            >
              {isSavingBatch ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Valider l'Émargement ({filteredLearners.length})</span>
            </button>
          </div>
        </div>

        {/* Table d'Appel des Apprenants */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] font-extrabold tracking-wider">
                <th className="pb-3 px-2">Apprenant</th>
                <th className="pb-3 px-2">Groupe / Classe</th>
                <th className="pb-3 px-2">Rôle</th>
                <th className="pb-3 px-2 text-center">Statut d'Émargement</th>
                <th className="pb-3 px-2">Retard (min)</th>
                <th className="pb-3 px-2">Remarque / Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-secondary">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Users size={22} />
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        Aucun apprenant réel inscrit dans ce groupe pour le moment.
                      </p>
                      <p className="text-xs text-text-secondary max-w-sm">
                        Seuls les comptes réels enregistrés apparaissent dans cette liste officielle d'émargement.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 mt-2 shadow-md"
                      >
                        <Plus size={14} />
                        <span>Inscrire un Apprenant Réel</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLearners.map((learner) => {
                  const state = rollCallState[learner.id] || {
                    status: 'present',
                    minutes_late: 0,
                    remarks: ''
                  };

                  return (
                    <tr key={learner.id} className="hover:bg-surface/50 transition-colors">
                      {/* Name / Email */}
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs uppercase border border-primary/20">
                            {learner.email.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-text-primary">{learner.email}</p>
                            <span className="text-[10px] text-text-secondary">ID #{learner.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Group Badge */}
                      <td className="py-3 px-2">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                          {learner.group_name || 'Groupe A - Informatique & IA'}
                        </span>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-surface border border-border text-text-secondary">
                          {learner.role}
                        </span>
                      </td>

                      {/* 4 Status Pills */}
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Présent */}
                          <button
                            type="button"
                            onClick={() => setRollCallState(prev => ({
                              ...prev,
                              [learner.id]: { ...prev[learner.id], status: 'present', minutes_late: 0 }
                            }))}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                              state.status === 'present'
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
                            }`}
                          >
                            Présent
                          </button>

                          {/* Retard */}
                          <button
                            type="button"
                            onClick={() => setRollCallState(prev => ({
                              ...prev,
                              [learner.id]: { 
                                ...prev[learner.id], 
                                status: 'late', 
                                minutes_late: prev[learner.id]?.minutes_late || 15 
                              }
                            }))}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                              state.status === 'late'
                                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
                            }`}
                          >
                            Retard
                          </button>

                          {/* Absent */}
                          <button
                            type="button"
                            onClick={() => setRollCallState(prev => ({
                              ...prev,
                              [learner.id]: { ...prev[learner.id], status: 'absent', minutes_late: 0 }
                            }))}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                              state.status === 'absent'
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                                : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
                            }`}
                          >
                            Absent
                          </button>

                          {/* Excusé */}
                          <button
                            type="button"
                            onClick={() => setRollCallState(prev => ({
                              ...prev,
                              [learner.id]: { ...prev[learner.id], status: 'excused', minutes_late: 0 }
                            }))}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                              state.status === 'excused'
                                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                                : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
                            }`}
                          >
                            Justifié
                          </button>
                        </div>
                      </td>

                      {/* Minutes late (only active if late) */}
                      <td className="py-3 px-2">
                        {state.status === 'late' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={240}
                              value={state.minutes_late}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setRollCallState(prev => ({
                                  ...prev,
                                  [learner.id]: { ...prev[learner.id], minutes_late: val }
                                }));
                              }}
                              className="w-16 px-2 py-1 rounded-lg bg-background border border-amber-500/40 text-center font-bold text-amber-500 outline-none"
                            />
                            <span className="text-text-secondary text-[10px]">min</span>
                          </div>
                        ) : (
                          <span className="text-text-secondary opacity-30 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Remarks / Justification */}
                      <td className="py-3 px-2">
                        <input
                          type="text"
                          placeholder="Motif / certificat médical / note..."
                          value={state.remarks}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRollCallState(prev => ({
                              ...prev,
                              [learner.id]: { ...prev[learner.id], remarks: val }
                            }));
                          }}
                          className="w-full px-2.5 py-1 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary text-text-primary"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 5. SECTION HISTORIQUE GLOBAL DES ÉMARGEMENTS */}
      <div className="glass-card rounded-3xl border border-border p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h3 className="font-extrabold text-base text-text-primary">
              Historique Général des Émargements Enregistrés
            </h3>
            <p className="text-xs text-text-secondary">
              Archives exhaustives des pointages de tous les étudiants, stagiaires et employés.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Rechercher par email..."
                className="pl-8 pr-3 py-1.5 bg-surface border border-border rounded-xl text-xs outline-none focus:border-primary text-text-primary"
              />
            </div>

            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-border rounded-xl text-xs outline-none focus:border-primary text-text-primary cursor-pointer"
            >
              <option value="">Tous statuts</option>
              <option value="present">Présent</option>
              <option value="late">Retard</option>
              <option value="absent">Absent</option>
              <option value="excused">Justifié</option>
            </select>

            <input
              type="date"
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-border rounded-xl text-xs outline-none focus:border-primary text-text-primary"
            />
          </div>
        </div>

        {/* History table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-secondary uppercase text-[10px] font-extrabold tracking-wider">
                <th className="pb-3 px-2">Date</th>
                <th className="pb-3 px-2">Apprenant</th>
                <th className="pb-3 px-2">Séance</th>
                <th className="pb-3 px-2">Statut</th>
                <th className="pb-3 px-2">Détails / Retard</th>
                <th className="pb-3 px-2">Pointé par</th>
                <th className="pb-3 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-secondary">
                    Aucun historique correspondant aux filtres.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3 px-2 font-mono font-bold text-text-primary">
                      {new Date(rec.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-2">
                      <p className="font-bold text-text-primary">{rec.user?.email || `ID #${rec.user_id}`}</p>
                      <span className="text-[10px] uppercase text-text-secondary">{rec.user?.role}</span>
                    </td>
                    <td className="py-3 px-2 text-text-secondary">
                      {rec.session_name}
                    </td>
                    <td className="py-3 px-2">
                      {rec.status === 'present' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Présent
                        </span>
                      )}
                      {rec.status === 'late' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Retard ({rec.minutes_late} min)
                        </span>
                      )}
                      {rec.status === 'absent' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          Absent
                        </span>
                      )}
                      {rec.status === 'excused' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          Justifié
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-text-secondary">
                      {rec.remarks || '—'}
                    </td>
                    <td className="py-3 px-2 text-text-secondary text-[11px]">
                      {rec.marked_by?.email ? rec.marked_by.email.split('@')[0] : 'Système'}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDeleteRecord(rec.id)}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Supprimer cet enregistrement"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. MODAL AJOUTER UN APPRENANT DANS UN GROUPE */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card max-w-md w-full p-6 sm:p-8 rounded-3xl border border-primary/30 space-y-5 animate-fade-in-up my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Users size={18} />
                <h3>Ajouter un Apprenant à un Groupe</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-text-secondary hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLearner} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase font-bold text-text-secondary mb-1">
                  Adresse Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="etudiant@eschola.pro"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                />
              </div>

              <div>
                <label className="block uppercase font-bold text-text-secondary mb-1">
                  Rôle *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary cursor-pointer"
                >
                  <option value="étudiant">Étudiant</option>
                  <option value="stagiaire">Stagiaire</option>
                  <option value="employer">Employé</option>
                </select>
              </div>

              <div>
                <label className="block uppercase font-bold text-text-secondary mb-1">
                  Groupe / Promotion *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Groupe A - Informatique & IA"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                />
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {groups.slice(0, 3).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setNewGroup(g)}
                      className="px-2 py-0.5 rounded-md bg-background text-[10px] text-text-secondary hover:text-text-primary border border-border"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 bg-surface hover:bg-surface-hover rounded-xl font-semibold border border-border text-text-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isAddingLearner}
                  className="w-1/2 btn-primary py-2.5 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {isAddingLearner ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
