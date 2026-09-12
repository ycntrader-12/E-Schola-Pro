'use client';

import { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  ShieldCheck,
  CheckCircle,
  Radio,
  Sparkles,
  AlertCircle,
  Loader2,
  X,
  Upload,
  Info,
  ExternalLink,
  Search
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import DeliverablesModal from '@/components/calendar/DeliverablesModal';
import DeliverablesGlobalModal from '@/components/calendar/DeliverablesGlobalModal';
import { getMoroccanHolidays, getMoroccanHolidayForDate, MoroccanHoliday } from '@/lib/moroccanHolidays';

interface Event {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  target_roles: string;
}

interface GroupItem {
  id: number;
  name: string;
  level?: string;
  description?: string;
}

export default function CalendarPage() {
  // Current authenticated user
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string } | null>(null);

  // Real-time system clock state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Calendar Navigation state
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  // Events & Loading state
  const [events, setEvents] = useState<Event[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Moroccan Holidays State
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  const [holidaySearchQuery, setHolidaySearchQuery] = useState('');

  // Event Creation & Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newRoles, setNewRoles] = useState('étudiant,stagiaire,employer');
  const [newGroupTarget, setNewGroupTarget] = useState('all');
  const [customGroupName, setCustomGroupName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deliverables Modal state
  const [deliverablesEvent, setDeliverablesEvent] = useState<Event | null>(null);
  const [showGlobalDeliverables, setShowGlobalDeliverables] = useState(false);

  // Check if user is Formateur or Administrator
  const canManageCalendar = ['formateur', 'admin', 'admin_manager'].includes(currentUser?.role || '');

  // 1. Live System Clock Synchronization
  useEffect(() => {
    // Initial sync
    setCurrentTime(new Date());

    // Update every second synchronized with system time
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 2. Fetch User & Events & Groups
  const fetchEvents = async () => {
    try {
      const [eventsRes, meRes, groupsRes] = await Promise.all([
        apiClient.get('/events/'),
        apiClient.get('/users/me').catch(() => null),
        apiClient.get('/groups').catch(() => ({ data: [] }))
      ]);
      if (meRes?.data) setCurrentUser(meRes.data);
      if (groupsRes?.data && Array.isArray(groupsRes.data)) {
        setAvailableGroups(groupsRes.data);
      }
      const sorted = eventsRes.data.sort((a: Event, b: Event) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setEvents(sorted);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erreur lors du chargement des événements');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // 3. Open Modal for Creation (Formateurs & Admins)
  const handleOpenAddModal = (dateToUse?: Date) => {
    setEditingEventId(null);
    const baseDate = dateToUse || currentTime || new Date();
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;

    const currentHour = baseDate.getHours();
    const startH = String((currentHour + 1) % 24).padStart(2, '0');
    const endH = String((currentHour + 2) % 24).padStart(2, '0');

    setNewTitle('');
    setNewDescription('');
    setNewStartDate(dateString);
    setNewStartTime(`${startH}:00`);
    setNewEndDate(dateString);
    setNewEndTime(`${endH}:00`);
    setNewRoles('étudiant,stagiaire,employer');
    setNewGroupTarget('all');
    setCustomGroupName('');
    setShowAddModal(true);
  };

  // 4. Open Modal for Editing (Formateurs & Admins)
  const handleOpenEditModal = (event: Event) => {
    setEditingEventId(event.id);
    setNewTitle(event.title);
    setNewDescription(event.description || '');

    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);

    const formatYMD = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    setNewStartDate(formatYMD(startDate));
    setNewStartTime(startDate.toTimeString().substring(0, 5));
    setNewEndDate(formatYMD(endDate));
    setNewEndTime(endDate.toTimeString().substring(0, 5));

    // Parse target_roles into role and group
    const rawTarget = event.target_roles || 'étudiant,stagiaire,employer';
    if (rawTarget.includes('Groupe:')) {
      const parts = rawTarget.split('|').map(s => s.trim());
      const grpPart = parts.find(p => p.startsWith('Groupe:')) || '';
      const rolePart = parts.find(p => !p.startsWith('Groupe:')) || 'étudiant,stagiaire,employer';
      const grpVal = grpPart.replace('Groupe:', '').trim();
      setNewRoles(rolePart);
      setNewGroupTarget(grpVal);
      setCustomGroupName(grpVal);
    } else {
      setNewRoles(rawTarget);
      setNewGroupTarget('all');
      setCustomGroupName('');
    }

    setShowAddModal(true);
  };

  // 5. Submit Event (Create or Update)
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStartDate || !newStartTime || !newEndDate || !newEndTime) return;

    setIsSubmitting(true);
    try {
      const startDateTime = new Date(`${newStartDate}T${newStartTime}:00`).toISOString();
      const endDateTime = new Date(`${newEndDate}T${newEndTime}:00`).toISOString();

      let finalTarget = newRoles;
      if (newGroupTarget && newGroupTarget !== 'all') {
        const gName = newGroupTarget === 'custom' ? customGroupName.trim() : newGroupTarget;
        if (gName) {
          finalTarget = `${newRoles} | Groupe: ${gName}`;
        }
      }

      if (editingEventId) {
        const res = await apiClient.put(`/events/${editingEventId}`, {
          title: newTitle.trim(),
          description: newDescription.trim(),
          start_time: startDateTime,
          end_time: endDateTime,
          target_roles: finalTarget
        });
        setEvents(prev => prev.map(e => e.id === editingEventId ? res.data : e).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      } else {
        const res = await apiClient.post('/events/', {
          title: newTitle.trim(),
          description: newDescription.trim(),
          start_time: startDateTime,
          end_time: endDateTime,
          target_roles: finalTarget
        });
        setEvents(prev => [...prev, res.data].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      }

      setShowAddModal(false);
      setEditingEventId(null);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de l’enregistrement du cours / planning.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Delete Event (Formateurs & Admins)
  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce cours / planning du calendrier ?')) return;
    try {
      await apiClient.delete(`/events/${eventId}`);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la suppression.');
    }
  };

  // Helpers for Month Grid
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));
  const jumpToToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now);
  };

  // Days in current month
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  // Normalize Monday as first day of week (0 = Monday, 6 = Sunday)
  const normalizedStartDay = (firstDayOfWeek + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Month and Day Formatting
  const monthName = viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

  // Filter events for selected day (if any)
  const eventsForSelectedDay = selectedDay
    ? events.filter(e => {
      const evDate = new Date(e.start_time);
      return (
        evDate.getDate() === selectedDay.getDate() &&
        evDate.getMonth() === selectedDay.getMonth() &&
        evDate.getFullYear() === selectedDay.getFullYear()
      );
    })
    : events;

  // Selected Day Moroccan Holiday
  const selectedDayHoliday = selectedDay ? getMoroccanHolidayForDate(selectedDay) : null;

  // All Moroccan holidays for currently viewed year
  const allYearHolidays = getMoroccanHolidays(currentYear);
  const filteredHolidays = allYearHolidays.filter(h =>
    h.name.toLowerCase().includes(holidaySearchQuery.toLowerCase()) ||
    h.nameAr.includes(holidaySearchQuery) ||
    h.date.includes(holidaySearchQuery) ||
    h.description.toLowerCase().includes(holidaySearchQuery.toLowerCase())
  );

  // Jump to holiday from modal
  const handleJumpToHoliday = (holidayDateStr: string) => {
    const parts = holidayDateStr.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const targetDate = new Date(y, m, d);
    setViewDate(new Date(y, m, 1));
    setSelectedDay(targetDate);
    setShowHolidaysModal(false);
  };

  // Format Helpers
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateFull = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Live status badge calculation
  const getEventStatus = (startStr: string, endStr: string) => {
    if (!currentTime) return null;
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const now = currentTime.getTime();

    if (now >= start && now <= end) {
      return { label: 'EN COURS', color: 'bg-primary/20 text-primary border-primary/30 animate-pulse' };
    } else if (now > end) {
      return { label: 'TERMINÉ', color: 'bg-slate-500/20 text-text-secondary border-slate-500/30' };
    } else {
      const diffMinutes = Math.round((start - now) / 60000);
      if (diffMinutes < 60) {
        return { label: `DANS ${diffMinutes} MIN`, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
      } else if (diffMinutes < 1440) {
        const h = Math.round(diffMinutes / 60);
        return { label: `DANS ${h} H`, color: 'bg-primary/20 text-primary border-primary/30' };
      } else {
        const days = Math.round(diffMinutes / 1440);
        return { label: `DANS ${days} J`, color: 'bg-primary/10 text-primary border-primary/20' };
      }
    }
  };

  return (
    <div className="min-h-screen px-4 py-24 max-w-7xl mx-auto space-y-8 animate-fade-in">

      {/* 1. TOP HERO & LIVE SYSTEM CLOCK (AI TECH SYNCHRONIZED) */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-border shadow-xl relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Title */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Calendrier & <span className="text-brand-gradient">Emploi du Temps</span>
            </h1>
            <p className="text-text-secondary text-xs sm:text-sm max-w-lg">
              Date et heure système synchronisées en temps réel. Planifiez et consultez l&apos;ensemble de vos cours, examens et événements.
            </p>
          </div>

          {/* Right Live Clock Card */}
          <div className="glass-panel p-5 rounded-2xl border border-primary/30 bg-surface/60 backdrop-blur-xl flex flex-col sm:flex-row items-center gap-6 shadow-lg shadow-primary/10 min-w-[320px]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-md shadow-primary/30 shrink-0">
                <Clock size={24} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">
                  Horloge Système en Direct
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-text-primary text-glow">
                  {currentTime
                    ? currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
              </div>
            </div>

            <div className="h-10 w-px bg-border hidden sm:block" />

            <div className="text-center sm:text-left">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                {currentTime ? currentTime.toLocaleDateString([], { weekday: 'long' }) : '---'}
              </span>
              <span className="text-sm sm:text-base font-bold text-text-primary block capitalize">
                {currentTime
                  ? currentTime.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Chargement...'}
              </span>
              <span className="text-[10px] text-text-secondary font-mono">
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CALENDAR CONTROLS & ADD BUTTON & MOROCCO HOLIDAYS QUICK BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={prevMonth}
            className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border transition-colors text-text-secondary hover:text-text-primary"
            title="Mois précédent"
          >
            <ChevronLeft size={18} />
          </button>

          <h2 className="text-base sm:text-lg font-bold capitalize min-w-[170px] text-center text-text-primary">
            {monthName}
          </h2>

          <button
            onClick={nextMonth}
            className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border transition-colors text-text-secondary hover:text-text-primary"
            title="Mois suivant"
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={jumpToToday}
            className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-all"
          >
            Aujourd'hui
          </button>

          <button
            onClick={() => setShowHolidaysModal(true)}
            className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Voir tous les jours fériés officiels au Maroc"
          >
            <span>🇲🇦</span>
            <span>Jours Fériés Maroc</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-extrabold ml-0.5">
              {allYearHolidays.length}
            </span>
          </button>
        </div>

        {canManageCalendar ? (
          <button
            onClick={() => handleOpenAddModal(selectedDay || undefined)}
            className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/25 w-fit"
          >
            <Plus size={16} /> Planifier un cours / planning
          </button>
        ) : (
          <button
            onClick={() => setShowGlobalDeliverables(true)}
            className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/25 w-fit"
          >
            <Upload size={16} /> Soumettre un livrable
          </button>
        )}
      </div>

      {/* 3. MAIN GRID : INTERACTIVE MONTH VIEW & EVENTS LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left : Interactive Month Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card p-5 rounded-2xl border border-border">

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-3 text-center">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, i) => (
                <span key={i} className="text-xs font-bold text-text-secondary uppercase">
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty leading padding days */}
              {Array.from({ length: normalizedStartDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[72px] rounded-xl border border-transparent opacity-10" />
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const cellDate = new Date(currentYear, currentMonth, dayNum);

                // Moroccan Public Holiday Check
                const moroccanHoliday = getMoroccanHolidayForDate(cellDate);

                // Is Today (system date)?
                const isToday = currentTime &&
                  cellDate.getDate() === currentTime.getDate() &&
                  cellDate.getMonth() === currentTime.getMonth() &&
                  cellDate.getFullYear() === currentTime.getFullYear();

                // Is Selected Day?
                const isSelected = selectedDay &&
                  cellDate.getDate() === selectedDay.getDate() &&
                  cellDate.getMonth() === selectedDay.getMonth() &&
                  cellDate.getFullYear() === selectedDay.getFullYear();

                // Events on this day
                const dayEvents = events.filter(e => {
                  const evDate = new Date(e.start_time);
                  return (
                    evDate.getDate() === dayNum &&
                    evDate.getMonth() === currentMonth &&
                    evDate.getFullYear() === currentYear
                  );
                });

                return (
                  <button
                    key={dayNum}
                    onClick={() => setSelectedDay(cellDate)}
                    className={`min-h-[72px] p-1.5 rounded-xl border flex flex-col justify-between items-start transition-all relative group text-left ${isSelected
                      ? 'bg-primary/20 border-primary text-text-primary shadow-md shadow-primary/20 ring-1 ring-primary'
                      : isToday
                        ? 'bg-primary/10 border-blue-500 text-text-primary font-bold'
                        : moroccanHoliday
                          ? 'bg-blue-500/10 dark:bg-blue-950/25 border-blue-400/40 dark:border-blue-500/40 text-text-primary hover:border-blue-500 hover:bg-blue-500/15'
                          : 'bg-surface/50 hover:bg-surface border-border text-text-secondary hover:text-text-primary'
                      }`}
                  >
                    <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className={`text-xs ${isToday
                          ? 'w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-extrabold shadow-xs'
                          : moroccanHoliday
                            ? 'font-extrabold text-[#1877f2] dark:text-blue-400'
                            : 'font-semibold'
                          }`}>
                          {dayNum}
                        </span>
                        {moroccanHoliday && (
                          <span className="text-[10px] leading-none" title={`Jour Férié Maroc : ${moroccanHoliday.name}`}>
                            🇲🇦
                          </span>
                        )}
                      </div>
                      {isToday && (
                        <span className="text-[9px] uppercase font-bold text-primary hidden sm:inline">
                          Auj.
                        </span>
                      )}
                    </div>

                    {/* Moroccan Holiday Micro Badge */}
                    {moroccanHoliday && (
                      <div
                        className="w-full text-[8px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100/90 dark:bg-blue-900/50 border border-blue-200/60 dark:border-blue-800/60 px-1 py-0.5 rounded truncate leading-tight my-0.5 shadow-2xs"
                        title={`Jour Férié Officiel : ${moroccanHoliday.name} (${moroccanHoliday.nameAr})`}
                      >
                        {moroccanHoliday.name}
                      </div>
                    )}

                    {/* Event indicators dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex items-center gap-1 w-full overflow-hidden mt-auto">
                        {dayEvents.slice(0, 3).map((ev, idx) => (
                          <span
                            key={idx}
                            className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-secondary shrink-0"
                            title={ev.title}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] font-bold text-primary">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

          </div>
        </div>

        {/* Right : Events of the Selected Day (5 cols) */}
        <div className="lg:col-span-5 space-y-4">

          {/* Header Card */}
          <div className="glass-card p-5 rounded-2xl border border-border flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Événements du jour
              </p>
              <h3 className="text-base font-bold text-text-primary capitalize">
                {selectedDay
                  ? selectedDay.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Tous les événements'}
              </h3>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20">
              {eventsForSelectedDay.length} cours / événement(s)
            </span>
          </div>

          {/* 🇲🇦 Moroccan Public Holiday Highlight Card */}
          {selectedDayHoliday && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-950/40 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100 space-y-2 animate-fade-in shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🇲🇦</span>
                  <span className="text-[11px] font-bold text-[#1877f2] dark:text-blue-400 uppercase tracking-wider">
                    Jour Férié Officiel au Maroc
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/15 text-[#1877f2] dark:text-blue-300 border border-blue-500/25">
                  {selectedDayHoliday.type === 'national' ? 'Fête Nationale' : 'Fête Religieuse'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {selectedDayHoliday.name}
                  </h4>
                  <span className="text-xs font-bold text-[#1877f2] dark:text-blue-400">
                    {selectedDayHoliday.nameAr}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-blue-200/90 mt-1">
                  {selectedDayHoliday.description}
                </p>
                <div className="mt-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/60 flex items-center justify-between text-[10px] text-slate-600 dark:text-blue-300 font-semibold">
                  <span>Statut</span>
                  <span className="font-bold text-[#1877f2] dark:text-blue-300">Jour chômé et payé (Maroc)</span>
                </div>
              </div>
            </div>
          )}

          {/* Events List */}
          <div className="space-y-3 overflow-y-auto max-h-[460px]">
            {isLoading ? (
              <div className="glass-card p-8 text-center text-text-secondary">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Chargement des événements...
              </div>
            ) : eventsForSelectedDay.length === 0 ? (
              <div className="glass-card p-8 rounded-2xl border border-border text-center text-text-secondary space-y-3">
                <CalendarIcon size={32} className="mx-auto opacity-20" />
                <p className="text-sm font-semibold">
                  {selectedDayHoliday ? "Journée de repos (Férié officiel)" : "Aucun événement prévu ce jour-ci"}
                </p>
                <p className="text-xs max-w-xs mx-auto">
                  {selectedDayHoliday
                    ? "Profitez de cette journée fériée nationale !"
                    : "Votre emploi du temps est libre pour cette date."}
                </p>
                {canManageCalendar && (
                  <button
                    onClick={() => handleOpenAddModal(selectedDay || undefined)}
                    className="px-4 py-2 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold transition-colors inline-flex items-center gap-1.5 mt-2"
                  >
                    <Plus size={14} /> Ajouter un cours / créneau
                  </button>
                )}
              </div>
            ) : (
              eventsForSelectedDay.map((event) => {
                const status = getEventStatus(event.start_time, event.end_time);

                return (
                  <div
                    key={event.id}
                    className="glass-card p-4 rounded-2xl border border-border hover:border-primary/40 transition-all space-y-3 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                            {event.title}
                          </h4>
                          {status && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${status.color}`}>
                              {status.label}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-text-secondary line-clamp-2">
                          {event.description || 'Aucune description fournie.'}
                        </p>
                      </div>

                      {canManageCalendar && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditModal(event)}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-surface transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-border/50 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-primary font-semibold">
                        <Clock size={14} />
                        <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-text-secondary flex-wrap">
                        {event.target_roles?.includes('Groupe:') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <span>👥</span>
                            <span>{event.target_roles.split('Groupe:')[1]?.trim()}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Users size={12} />
                          <span className="capitalize">
                            {event.target_roles?.split('|')[0]?.trim().replace('étudiant,stagiaire,employer', 'Tous') || 'Tous'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Deliverables quick action */}
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        onClick={() => setDeliverablesEvent(event)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <Upload size={13} />
                        <span>Livrables &amp; Devoirs</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL : LISTE COMPLÈTE DES JOURS FÉRIÉS AU MAROC                          */}
      {/* ========================================================================= */}
      {showHolidaysModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full p-6 rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl space-y-4 animate-fade-in max-h-[85vh] flex flex-col">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🇲🇦</span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    Jours Fériés Officiels au Royaume du Maroc ({currentYear})
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Calendrier officiel des fêtes nationales et religieuses chômées et payées
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHolidaysModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Rechercher une fête (ex: Trône, Aïd, Yennayer, Indépendance)..."
                value={holidaySearchQuery}
                onChange={(e) => setHolidaySearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Holidays List */}
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
              {filteredHolidays.map((holiday) => {
                const parts = holiday.date.split('-');
                const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const formattedDate = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

                return (
                  <div
                    key={holiday.id}
                    className="p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition-all flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900">
                          {holiday.name}
                        </span>
                        <span className="text-xs font-bold text-[#1877f2]">
                          {holiday.nameAr}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${holiday.type === 'national'
                          ? 'bg-blue-100 text-[#1877f2] border border-blue-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}>
                          {holiday.type === 'national' ? 'Fête Civile / Nationale' : 'Fête Religieuse Islamique'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        {holiday.description}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-800 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {formattedDate}
                      </span>
                      <button
                        onClick={() => handleJumpToHoliday(holiday.date)}
                        className="px-3 py-1 text-[11px] font-bold text-[#1877f2] hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Afficher</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Total : {allYearHolidays.length} jours fériés officiels pour l'année {currentYear}</span>
              <button
                onClick={() => setShowHolidaysModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold text-slate-700 transition-colors"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : PLANIFIER UN ÉVÉNEMENT / COURS                                   */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL : PLANIFIER UN ÉVÉNEMENT / COURS (PANORAMIQUE & ULTRA-LISIBLE)     */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL : PLANIFIER UN ÉVÉNEMENT / COURS (AJUSTAGE AUTO & ULTRA-LISIBLE)    */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in overflow-y-auto">
          <div className="max-w-5xl xl:max-w-6xl w-full p-5 md:p-6 rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-950/20 animate-fade-in-up max-h-[90vh] flex flex-col my-auto">

            {/* Panoramic Header - Mode Clair Ajusté */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
                  <CalendarIcon size={22} />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">
                    {editingEventId ? "Modifier le cours ou planning" : "Planifier un cours ou planning"}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Définissez l'intitulé, les objectifs, les promotions cibles et les créneaux horaires.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Panoramic Content (2 Columns Grid) - Ajusté & Hautement Lisible */}
            <div className="overflow-y-auto custom-scrollbar pr-1 md:pr-1.5 py-3 flex-1">
              <form id="calendar-event-form" onSubmit={handleCreateEvent} className="space-y-4">

                {/* Notice if selected date is a Moroccan Holiday */}
                {newStartDate && getMoroccanHolidayForDate(newStartDate) && (
                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 flex items-center gap-2.5 text-xs shadow-xs">
                    <span className="text-xl leading-none">🇲🇦</span>
                    <div>
                      <span className="font-bold text-[#1877f2]">Jour férié officiel au Maroc :</span>{" "}
                      La date du <strong>{newStartDate}</strong> correspond à <strong>{getMoroccanHolidayForDate(newStartDate)?.name}</strong> ({getMoroccanHolidayForDate(newStartDate)?.nameAr}).
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-start">

                  {/* LEFT COLUMN: Titre, Description, Public concerné (7 colonnes) */}
                  <div className="lg:col-span-7 space-y-3.5">

                    {/* Titre */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1 flex items-center justify-between">
                        <span>Titre de l'événement ou cours <span className="text-rose-600">*</span></span>
                        <span className="text-[11px] font-semibold text-slate-500">Requis</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Intelligence Artificielle & Big Data - Module 3"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold placeholder:text-slate-500 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-100 transition-all min-h-[42px]"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                        Description & Objectifs pédagogiques
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Détaillez les objectifs de la session, le lien visio (Teams/Meet/Zoom), l'ordre du jour ou les prérequis..."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm placeholder:text-slate-500 outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-100 resize-none leading-relaxed transition-all min-h-[82px]"
                      />
                    </div>

                    {/* Public concerné & Ciblage des Groupes */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                        {/* Rôle / Public Cible */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1 flex items-center gap-1.5">
                            <Users size={14} className="text-blue-600" />
                            <span>Public cible <span className="text-rose-600">*</span></span>
                          </label>
                          <select
                            value={newRoles}
                            onChange={(e) => setNewRoles(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-100 cursor-pointer transition-all min-h-[40px]"
                          >
                            <option value="étudiant,stagiaire,employer">Tous (Étudiants, Stagiaires, Employés)</option>
                            <option value="étudiant">Étudiants uniquement</option>
                            <option value="stagiaire">Stagiaires uniquement</option>
                            <option value="employer">Employés uniquement</option>
                            <option value="formateur,admin">Formateurs & Administration</option>
                          </select>
                        </div>

                        {/* Groupe / Promotion Cible */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[#1877f2] font-bold">👥</span>
                              <span>Groupe / Classe cible</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">Ciblage</span>
                          </label>
                          <select
                            value={newGroupTarget}
                            onChange={(e) => {
                              setNewGroupTarget(e.target.value);
                              if (e.target.value !== 'custom') {
                                setCustomGroupName('');
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold outline-none focus:bg-white focus:border-[#1877f2] focus:ring-3 focus:ring-blue-100 cursor-pointer transition-all min-h-[40px]"
                          >
                            <option value="all">🌐 Tous les groupes (Général)</option>

                            {/* Groupes enregistrés dans le système */}
                            {availableGroups && availableGroups.length > 0 && (
                              <optgroup label="Groupes enregistrés (Base de données)">
                                {availableGroups.map((g) => (
                                  <option key={g.id} value={g.name}>
                                    👥 {g.name} {g.level ? `(${g.level})` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {/* Classes & Promotions standards */}
                            <optgroup label="Promotions & Groupes académiques">
                              <option value="Groupe A">👥 Groupe A</option>
                              <option value="Groupe B">👥 Groupe B</option>
                              <option value="Groupe C">👥 Groupe C</option>
                              <option value="Promotion 2026">👥 Promotion 2026</option>
                              <option value="Master 1">👥 Master 1</option>
                              <option value="Master 2">👥 Master 2</option>
                              <option value="Licence / Bachelor">👥 Licence / Bachelor</option>
                            </optgroup>

                            <option value="custom">✏️ Saisir un autre groupe...</option>
                          </select>
                        </div>

                      </div>

                      {/* Champ conditionnel si saisie libre d'un groupe */}
                      {newGroupTarget === 'custom' && (
                        <div className="pt-1 animate-fade-in">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-1 flex items-center justify-between">
                            <span>Nom de la promotion / classe personnalisée <span className="text-rose-600">*</span></span>
                            <span className="text-[10px] text-slate-500">Ex: Dev-Web-2026, Section B...</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Saisissez l'intitulé du groupe ou de la classe..."
                            value={customGroupName}
                            onChange={(e) => setCustomGroupName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-blue-400 text-slate-900 text-xs font-semibold placeholder:text-slate-400 outline-none focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 transition-all min-h-[38px]"
                          />
                        </div>
                      )}
                    </div>

                  </div>

                  {/* RIGHT COLUMN: Planification, Dates & Heures (5 colonnes) */}
                  <div className="lg:col-span-5">
                    <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 sm:p-4.5 space-y-3 shadow-xs">

                      {/* Section Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs uppercase tracking-wider">
                          <Clock size={15} />
                          <span>Créneau & Horaires</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">Format 24h</span>
                      </div>

                      {/* Date & Heure Début */}
                      <div className="space-y-1.5">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                          Début de session <span className="text-rose-600">*</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <input
                              type="date"
                              required
                              value={newStartDate}
                              onChange={(e) => setNewStartDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all min-h-[40px]"
                            />
                          </div>
                          <div>
                            <input
                              type="time"
                              required
                              value={newStartTime}
                              onChange={(e) => setNewStartTime(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all min-h-[40px]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Date & Heure Fin */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                          Fin de session <span className="text-rose-600">*</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <input
                              type="date"
                              required
                              value={newEndDate}
                              onChange={(e) => setNewEndDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all min-h-[40px]"
                            />
                          </div>
                          <div>
                            <input
                              type="time"
                              required
                              value={newEndTime}
                              onChange={(e) => setNewEndTime(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all min-h-[40px]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Indicateur de durée dynamique */}
                      {(() => {
                        if (!newStartDate || !newStartTime || !newEndDate || !newEndTime) return null;
                        try {
                          const start = new Date(`${newStartDate}T${newStartTime}:00`);
                          const end = new Date(`${newEndDate}T${newEndTime}:00`);
                          const diffMs = end.getTime() - start.getTime();
                          if (diffMs < 0) {
                            return (
                              <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                                <span>L'heure de fin doit être après l'heure de début.</span>
                              </div>
                            );
                          }
                          const totalMinutes = Math.floor(diffMs / (1000 * 60));
                          const days = Math.floor(totalMinutes / (24 * 60));
                          const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                          const mins = totalMinutes % 60;
                          let durationStr = "";
                          if (days > 0) durationStr += `${days} j `;
                          if (hours > 0) durationStr += `${hours} h `;
                          if (mins > 0 || (!days && !hours)) durationStr += `${mins} min`;

                          return (
                            <div className="mt-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200/90 text-blue-900 text-xs flex items-center justify-between shadow-xs">
                              <span className="flex items-center gap-1.5 font-semibold text-blue-800">
                                <Clock size={13} className="text-blue-600" />
                                <span>Durée estimée :</span>
                              </span>
                              <span className="font-extrabold text-blue-700 bg-white px-2.5 py-0.5 rounded-md border border-blue-200">{durationStr.trim()}</span>
                            </div>
                          );
                        } catch {
                          return null;
                        }
                      })()}

                    </div>
                  </div>

                </div>
              </form>
            </div>

            {/* Panoramic Footer - Mode Clair Ajusté */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 shrink-0">
              <div className="text-xs text-slate-600 font-medium hidden sm:flex items-center gap-1.5">
                <Info size={14} className="text-blue-600 shrink-0" />
                <span>Les créneaux sont automatiquement synchronisés sur l'agenda des participants.</span>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 sm:flex-none px-5 py-2 bg-white hover:bg-slate-100 rounded-xl font-bold border border-slate-300 text-slate-700 text-sm transition-all min-h-[42px]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  form="calendar-event-form"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none px-7 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all min-h-[42px]"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : editingEventId ? (
                    <CheckCircle size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  {editingEventId ? "Sauvegarder" : "Enregistrer le cours"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL : LIVRABLES */}
      {deliverablesEvent && (
        <DeliverablesModal
          event={deliverablesEvent}
          currentUser={currentUser}
          onClose={() => setDeliverablesEvent(null)}
        />
      )}
      {/* MODAL : LIVRABLES GLOBAL */}
      {showGlobalDeliverables && (
        <DeliverablesGlobalModal
          currentUser={currentUser}
          onClose={() => setShowGlobalDeliverables(false)}
        />
      )}
    </div>
  );
}
