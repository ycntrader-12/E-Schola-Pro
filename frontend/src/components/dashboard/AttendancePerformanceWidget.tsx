'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  UserCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Award, 
  TrendingUp, 
  Calendar, 
  ShieldCheck, 
  ArrowRight,
  Loader2,
  FileText,
  Users
} from 'lucide-react';
import { apiClient } from '@/lib/api';

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
  recent_attendances: Array<{
    id: number;
    date: string;
    status: string;
    minutes_late: number;
    session_name: string;
    remarks?: string;
  }>;
}

export default function AttendancePerformanceWidget() {
  const [data, setData] = useState<DashboardPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'monthly' | 'semester'>('monthly');

  // Manager states
  const [isManager, setIsManager] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [learners, setLearners] = useState<{ id: number; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setIsLoading(true);
        const res = await apiClient.get('/attendance/my-stats');
        const myData = res.data;
        
        const isMgr = myData.user_role === 'formateur' || myData.user_role === 'admin';
        setIsManager(isMgr);
        
        if (isMgr) {
          const groupsRes = await apiClient.get('/attendance/groups');
          setGroups(groupsRes.data);
          
          if (groupsRes.data.length > 0) {
            const initialGroup = groupsRes.data[0];
            setSelectedGroup(initialGroup);
            const learnersRes = await apiClient.get(`/attendance/learners?group_name=${encodeURIComponent(initialGroup)}`);
            setLearners(learnersRes.data);
            
            if (learnersRes.data.length > 0) {
              const firstUser = learnersRes.data[0];
              setSelectedUserId(firstUser.id);
              const userStatsRes = await apiClient.get(`/attendance/user-stats/${firstUser.id}`);
              setData(userStatsRes.data);
            } else {
              setData(myData);
            }
          } else {
            setData(myData);
          }
        } else {
          setData(myData);
        }
      } catch (err) {
        console.error('Error fetching attendance performance:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitial();
  }, []);

  const handleGroupChange = async (group: string) => {
    setSelectedGroup(group);
    try {
      setIsLoading(true);
      const learnersRes = await apiClient.get(`/attendance/learners?group_name=${encodeURIComponent(group)}`);
      setLearners(learnersRes.data);
      if (learnersRes.data.length > 0) {
        const firstUser = learnersRes.data[0];
        setSelectedUserId(firstUser.id);
        const userStatsRes = await apiClient.get(`/attendance/user-stats/${firstUser.id}`);
        setData(userStatsRes.data);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserChange = async (userId: number) => {
    setSelectedUserId(userId);
    try {
      setIsLoading(true);
      const userStatsRes = await apiClient.get(`/attendance/user-stats/${userId}`);
      setData(userStatsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-border flex items-center justify-center min-h-[160px]">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!data) return null;

  const currentStats = data[selectedPeriod];

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm space-y-6 mb-8">
      
      {/* Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <UserCheck size={18} />
            </span>
            <h3 className="font-extrabold text-base text-text-primary">
              Suivi d'Assiduité & Performances Académiques
            </h3>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            {isManager 
              ? "Vue analytique. Sélectionnez un groupe et un apprenant pour auditer ses performances."
              : "Vos taux de présence, retards, absences et points de quiz en temps réel."}
          </p>

          {/* Manager Filters */}
          {isManager && (
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-border">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Users size={14} className="text-text-secondary shrink-0" />
                <select 
                  value={selectedGroup}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full sm:w-48 text-xs bg-white border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-primary"
                >
                  {groups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <UserCheck size={14} className="text-text-secondary shrink-0" />
                <select 
                  value={selectedUserId || ''}
                  onChange={(e) => handleUserChange(Number(e.target.value))}
                  className="w-full sm:w-48 text-xs bg-white border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-primary"
                >
                  {learners.map(l => (
                    <option key={l.id} value={l.id}>{l.email}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          {/* Formateur & Admin link to manage attendance */}
          {isManager && (
            <Link
              href="/attendance"
              className="btn-primary whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 shrink-0"
            >
              <ShieldCheck size={14} />
              <span>Feuille d'émargement globale</span>
            </Link>
          )}

          {/* Period selector tabs */}
          <div className="flex items-center bg-background p-1 rounded-xl border border-border text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setSelectedPeriod('daily')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg transition-all ${
                selectedPeriod === 'daily' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setSelectedPeriod('monthly')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg transition-all ${
                selectedPeriod === 'monthly' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Ce Mois
            </button>
            <button
              onClick={() => setSelectedPeriod('semester')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg transition-all ${
                selectedPeriod === 'semester' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Ce Semestre
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* 1. Taux de Présence */}
        <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Taux d'Assiduité
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black font-mono ${
                currentStats.attendance_rate >= 80 ? 'text-emerald-500' : 'text-amber-500'
              }`}>
                {currentStats.attendance_rate}%
              </span>
            </div>
            <p className="text-[10px] text-text-secondary mt-1">
              {currentStats.present} présent(s) sur {currentStats.total_sessions} session(s)
            </p>
          </div>
          {/* Micro progress bar */}
          <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                currentStats.attendance_rate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, currentStats.attendance_rate)}%` }}
            />
          </div>
        </div>

        {/* 2. Retards & Absences */}
        <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Retards & Absences
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="flex items-center justify-around py-1">
            <div className="text-center">
              <span className="text-xl font-black font-mono text-amber-500 block">
                {currentStats.late}
              </span>
              <span className="text-[10px] text-text-secondary">Retards</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <span className="text-xl font-black font-mono text-rose-500 block">
                {currentStats.absent}
              </span>
              <span className="text-[10px] text-text-secondary">Absences</span>
            </div>
          </div>
          <p className="text-[10px] text-text-secondary text-center">
            {currentStats.excused} absence(s) justifiée(s)
          </p>
        </div>

        {/* 3. Points de Quiz Réalisés */}
        <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Points Réalisés
            </span>
            <Award size={16} className="text-primary" />
          </div>
          <div>
            <span className="text-2xl font-black font-mono text-primary">
              {currentStats.quiz_points}
            </span>
            <span className="text-xs font-bold text-text-secondary ml-1">pts</span>
            <p className="text-[10px] text-text-secondary mt-1">
              Sur {currentStats.quizzes_taken} quiz validé(s)
            </p>
          </div>
          <span className="text-[10px] font-bold text-primary">
            Cumul de la période
          </span>
        </div>

        {/* 4. Moyenne des Notes /20 */}
        <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Moyenne des Quiz
            </span>
            <TrendingUp size={16} className="text-secondary" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-text-primary">
                {currentStats.quiz_average_note}
              </span>
              <span className="text-xs font-bold text-text-secondary">/ 20</span>
            </div>
            <p className="text-[10px] text-text-secondary mt-1">
              Taux de réussite : {currentStats.quiz_success_rate}%
            </p>
          </div>
          <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-secondary h-full transition-all duration-500"
              style={{ width: `${Math.min(100, (currentStats.quiz_average_note / 20) * 100)}%` }}
            />
          </div>
        </div>

      </div>

      {/* Derniers Émargements Enregistrés */}
      {data.recent_attendances.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider mb-2.5 flex items-center gap-1.5">
            <Calendar size={13} />
            <span>Historique Récent des Pointages</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {data.recent_attendances.slice(0, 3).map((att) => (
              <div 
                key={att.id} 
                className="p-3 rounded-xl bg-background border border-border flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-text-primary">{new Date(att.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  <p className="text-[10px] text-text-secondary">{att.session_name}</p>
                </div>

                <div>
                  {att.status === 'present' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Présent
                    </span>
                  )}
                  {att.status === 'late' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Retard ({att.minutes_late} min)
                    </span>
                  )}
                  {att.status === 'absent' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      Absent
                    </span>
                  )}
                  {att.status === 'excused' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      Justifié
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
