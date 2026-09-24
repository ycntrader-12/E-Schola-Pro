'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from '@/i18n/routing';
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
  Users,
  Download,
  Search,
  ChevronDown,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { isStaff } from '@/lib/roles';

interface OptionItem {
  id: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface LearnerItem {
  id: number;
  email: string;
  role?: string;
  group_name?: string | null;
  nom?: string | null;
  prenom?: string | null;
}

function SearchableSelect({
  label,
  icon,
  placeholder,
  options,
  selectedValue,
  onSelect,
  emptyText = "Aucun résultat trouvé",
  disabled = false
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  options: OptionItem[];
  selectedValue: string | number | null;
  onSelect: (value: any) => void;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected option
  const selectedOption = useMemo(() => {
    return options.find(opt => String(opt.id) === String(selectedValue));
  }, [options, selectedValue]);

  // Keep input text in sync when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOption ? selectedOption.label : '');
      setIsTyping(false);
    }
  }, [selectedOption, isOpen]);

  // Filter options: if user is typing a search query, filter; otherwise SHOW ALL OPTIONS
  const filteredOptions = useMemo(() => {
    if (!isTyping || !searchTerm.trim()) {
      return options;
    }
    const q = searchTerm.toLowerCase().trim();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(q) || 
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchTerm, isTyping]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        setSearchTerm(selectedOption ? selectedOption.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const handleOpenDropdown = () => {
    if (disabled) return;
    setIsTyping(false);
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.select();
    }, 10);
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[260px] w-full">
      {/* Field Label */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <span className="p-1 rounded bg-primary/10 text-primary">{icon}</span>
          <span>{label}</span>
        </label>
        <span className="text-[10px] text-text-secondary font-medium">
          {options.length} disponible{options.length > 1 ? 's' : ''}
        </span>
      </div>
      
      {/* Input container */}
      <div className="relative">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsTyping(true);
              if (!isOpen) setIsOpen(true);
            }}
            onClick={handleOpenDropdown}
            onFocus={handleOpenDropdown}
            placeholder={placeholder}
            className="w-full text-xs font-medium bg-white border border-border rounded-xl pl-8 pr-16 py-2.5 text-text-primary placeholder:text-text-secondary/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all shadow-sm disabled:opacity-60 disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          <Search size={14} className="absolute left-2.5 text-text-secondary pointer-events-none" />
          
          <div className="absolute right-2 flex items-center gap-0.5">
            {searchTerm && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                  setIsTyping(false);
                  if (!isOpen) setIsOpen(true);
                  inputRef.current?.focus();
                }}
                className="p-1 hover:bg-slate-100 rounded-md text-text-secondary hover:text-text-primary transition-colors"
                title="Afficher tous les objets / effacer"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (isOpen) {
                  setIsOpen(false);
                  setIsTyping(false);
                  setSearchTerm(selectedOption ? selectedOption.label : '');
                } else {
                  handleOpenDropdown();
                }
              }}
              className="p-1 text-text-secondary hover:text-text-primary transition-transform"
              title={isOpen ? "Fermer la liste" : "Afficher tous les objets à sélectionner"}
            >
              <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && !disabled && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-border shadow-2xl max-h-72 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-150 ring-1 ring-black/5">
            <div className="px-3 py-1.5 border-b border-border/60 text-[10px] font-bold text-text-secondary flex items-center justify-between bg-slate-50 sticky top-0 z-10 shadow-xs">
              {isTyping && searchTerm.trim() ? (
                <>
                  <span className="text-primary font-bold">{filteredOptions.length} trouvé{filteredOptions.length > 1 ? 's' : ''} sur {options.length}</span>
                  <span className="text-text-secondary truncate max-w-[140px]">Recherche: "{searchTerm}"</span>
                </>
              ) : (
                <>
                  <span className="text-text-primary font-bold">Tous les objets ({options.length})</span>
                  <span className="text-primary text-[10px] font-semibold">Sélectionnez un élément</span>
                </>
              )}
            </div>
            
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs text-text-secondary flex flex-col items-center gap-1.5">
                <AlertCircle size={18} className="text-amber-500/70" />
                <span>{emptyText}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setIsTyping(false);
                  }}
                  className="text-[11px] text-primary hover:underline mt-1 font-semibold"
                >
                  Afficher tous les {options.length} objets disponibles
                </button>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.id) === String(selectedValue);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelect(opt.id);
                      setSearchTerm(opt.label);
                      setIsTyping(false);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2.5 hover:bg-primary/5 transition-colors border-b border-border/30 last:border-0 ${
                      isSelected ? 'bg-primary/10 font-bold text-primary' : 'text-text-primary'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isSelected && <Check size={13} className="text-primary shrink-0 stroke-[2.5]" />}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {opt.sublabel && (
                        <span className="text-[10px] text-text-secondary truncate mt-0.5">{opt.sublabel}</span>
                      )}
                    </div>
                    {opt.badge && (
                      <span className={`text-[9px] px-2 py-0.5 rounded font-semibold shrink-0 ${
                        isSelected 
                          ? 'bg-primary text-white' 
                          : 'bg-slate-100 text-text-secondary'
                      }`}>
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'monthly' | 'semester'>('monthly');

  // Manager states
  const [isManager, setIsManager] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setIsInitialLoading(true);
        const res = await apiClient.get('/attendance/my-stats');
        const myData = res.data;
        
        const isMgr = isStaff(myData.user_role);
        setIsManager(isMgr);
        
        if (isMgr) {
          const groupsRes = await apiClient.get('/attendance/groups');
          const groupList: string[] = groupsRes.data || [];
          setGroups(groupList);
          
          const initialGroup = groupList.length > 0 ? groupList[0] : 'all';
          setSelectedGroup(initialGroup);

          const learnersRes = await apiClient.get(
            initialGroup === 'all'
              ? '/attendance/learners?group_name=all'
              : `/attendance/learners?group_name=${encodeURIComponent(initialGroup)}`
          );
          const initialLearners: LearnerItem[] = learnersRes.data || [];
          setLearners(initialLearners);
          
          if (initialLearners.length > 0) {
            const firstUser = initialLearners[0];
            setSelectedUserId(firstUser.id);
            const userStatsRes = await apiClient.get(`/attendance/user-stats/${firstUser.id}`);
            setData(userStatsRes.data);
          } else {
            setData(myData);
          }
        } else {
          setData(myData);
        }
      } catch (err) {
        console.error('Error fetching attendance performance:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };
    fetchInitial();
  }, []);

  const handleGroupChange = async (group: string) => {
    setSelectedGroup(group);
    try {
      setIsStatsLoading(true);
      const learnersRes = await apiClient.get(
        group === 'all'
          ? '/attendance/learners?group_name=all'
          : `/attendance/learners?group_name=${encodeURIComponent(group)}`
      );
      const fetchedLearners: LearnerItem[] = learnersRes.data || [];
      setLearners(fetchedLearners);
      
      if (fetchedLearners.length > 0) {
        const userExists = fetchedLearners.some(l => l.id === selectedUserId);
        const targetUserId = userExists && selectedUserId ? selectedUserId : fetchedLearners[0].id;
        setSelectedUserId(targetUserId);
        const userStatsRes = await apiClient.get(`/attendance/user-stats/${targetUserId}`);
        setData(userStatsRes.data);
      } else {
        setData(null);
        setSelectedUserId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const handleUserChange = async (userId: number) => {
    setSelectedUserId(userId);
    try {
      setIsStatsLoading(true);
      const userStatsRes = await apiClient.get(`/attendance/user-stats/${userId}`);
      setData(userStatsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const groupOptions: OptionItem[] = useMemo(() => {
    const list: OptionItem[] = [
      {
        id: 'all',
        label: 'Tous les groupes (Toutes promotions)',
        sublabel: `${groups.length} groupes disponibles`,
        badge: 'Global'
      }
    ];
    groups.forEach(g => {
      list.push({
        id: g,
        label: g,
        sublabel: 'Classe / Promotion',
        badge: 'Groupe'
      });
    });
    return list;
  }, [groups]);

  const learnerOptions: OptionItem[] = useMemo(() => {
    return learners.map(l => {
      const fullName = [l.prenom, l.nom].filter(Boolean).join(' ');
      return {
        id: l.id,
        label: fullName ? `${fullName} (${l.email})` : l.email,
        sublabel: `ID #${l.id} • ${l.group_name ? `Groupe: ${l.group_name}` : 'Sans groupe assigné'}`,
        badge: (l.role || 'Apprenant').toUpperCase()
      };
    });
  }, [learners]);

  if (isInitialLoading) {
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
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-border">
        <div className="flex-1">
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
            <div className="mt-4 p-4 bg-slate-50/90 rounded-2xl border border-border shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
                <SearchableSelect
                  label="Groupe / Promotion"
                  icon={<Users size={13} />}
                  placeholder="Rechercher un groupe..."
                  options={groupOptions}
                  selectedValue={selectedGroup}
                  onSelect={(val) => handleGroupChange(String(val))}
                  emptyText="Aucun groupe correspondant"
                />

                <div className="hidden sm:block w-px h-12 bg-border self-center" />

                <SearchableSelect
                  label="Apprenant / Étudiant"
                  icon={<UserCheck size={13} />}
                  placeholder={learners.length === 0 ? "Aucun apprenant disponible" : "Rechercher par nom ou email..."}
                  options={learnerOptions}
                  selectedValue={selectedUserId}
                  onSelect={(val) => handleUserChange(Number(val))}
                  disabled={learners.length === 0}
                  emptyText="Aucun apprenant trouvé"
                />
              </div>

              {/* Quick Group Selection Buttons */}
              <div className="flex items-center gap-1.5 pt-2.5 border-t border-border/50 flex-wrap">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Users size={11} /> Groupes rapides :
                </span>
                <button
                  type="button"
                  onClick={() => handleGroupChange('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedGroup === 'all'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-text-secondary border border-border'
                  }`}
                >
                  Tous ({groups.length})
                </button>
                {groups.map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => handleGroupChange(grp)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      selectedGroup === grp
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-text-secondary border border-border'
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>

              {/* Status footer displaying currently selected objects */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary pt-1 px-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Cible :
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-border font-medium">
                    Groupe : <strong className="text-primary">{selectedGroup === 'all' ? 'Toutes promotions' : selectedGroup}</strong>
                  </span>
                  {selectedUserId && (
                    <span className="px-2 py-0.5 rounded-md bg-white border border-border font-medium">
                      Apprenant : <strong className="text-text-primary">{learnerOptions.find(o => o.id === selectedUserId)?.label || `#${selectedUserId}`}</strong>
                    </span>
                  )}
                  <span className="text-[10px] text-text-secondary">
                    ({learners.length} apprenant{learners.length > 1 ? 's' : ''} disponible{learners.length > 1 ? 's' : ''})
                  </span>
                </div>
                {isStatsLoading && (
                  <span className="inline-flex items-center gap-1 text-primary text-xs font-semibold">
                    <Loader2 size={12} className="animate-spin" />
                    Chargement des métriques...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          {/* Formateur & Admin link to manage attendance */}
          {isManager && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="btn-primary whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 shrink-0"
                style={{ backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#e0e7ff' }}
                title="Exporter au format PDF"
              >
                <Download size={14} />
                <span>Exporter en PDF</span>
              </button>
              <Link
                href="/attendance"
                className="btn-primary whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 shrink-0"
              >
                <ShieldCheck size={14} />
                <span>Feuille d'émargement globale</span>
              </Link>
            </div>
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
