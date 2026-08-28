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
  Upload
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import DeliverablesModal from '@/components/calendar/DeliverablesModal';
import DeliverablesGlobalModal from '@/components/calendar/DeliverablesGlobalModal';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deliverables Modal state
  const [deliverablesEvent, setDeliverablesEvent] = useState<Event | null>(null);
  const [showGlobalDeliverables, setShowGlobalDeliverables] = useState(false);

  // Check if user is Formateur or Administrator
  const canManageCalendar = currentUser?.role === 'formateur' || currentUser?.role === 'admin';

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
    setNewRoles(event.target_roles || 'étudiant,stagiaire,employer');
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

      if (editingEventId) {
        const res = await apiClient.put(`/events/${editingEventId}`, {
          title: newTitle.trim(),
          description: newDescription.trim(),
          start_time: startDateTime,
          end_time: endDateTime,
          target_roles: newRoles
        });
        setEvents(prev => prev.map(e => e.id === editingEventId ? res.data : e).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      } else {
        const res = await apiClient.post('/events/', {
          title: newTitle.trim(),
          description: newDescription.trim(),
          start_time: startDateTime,
          end_time: endDateTime,
          target_roles: newRoles
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
      return { label: 'EN COURS', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse' };
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
          {/* Left Title & System Sync Badge */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SYNCHRONISÉ AVEC LE SYSTÈME</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Calendrier & <span className="text-gradient">Emploi du Temps</span>
            </h1>
            <p className="text-text-secondary text-xs sm:text-sm max-w-lg">
              Date et heure système synchronisées en temps réel. Consultez et planifiez vos cours, visioconférences et réunions.
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

      {/* 2. CALENDAR CONTROLS & ADD BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border transition-colors text-text-secondary hover:text-text-primary"
            title="Mois précédent"
          >
            <ChevronLeft size={18} />
          </button>
          
          <h2 className="text-lg font-bold capitalize min-w-[180px] text-center text-text-primary">
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
            className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-all ml-2"
          >
            Aujourd'hui (Système)
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
                <div key={`empty-${i}`} className="h-16 rounded-xl border border-transparent opacity-10" />
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const cellDate = new Date(currentYear, currentMonth, dayNum);

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
                    className={`h-16 p-1.5 rounded-xl border flex flex-col justify-between items-start transition-all relative group text-left ${
                      isSelected
                        ? 'bg-primary/20 border-primary text-text-primary shadow-md shadow-primary/20'
                        : isToday
                        ? 'bg-primary/10 border-cyan-400 text-text-primary font-bold'
                        : 'bg-surface/50 hover:bg-surface border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span className={`text-xs ${isToday ? 'w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-extrabold shadow-sm' : 'font-semibold'}`}>
                        {dayNum}
                      </span>
                      {isToday && (
                        <span className="text-[9px] uppercase font-bold text-cyan-400 hidden sm:inline">
                          Auj.
                        </span>
                      )}
                    </div>

                    {/* Event indicators dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex items-center gap-1 w-full overflow-hidden">
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
              {eventsForSelectedDay.length} événement(s)
            </span>
          </div>

          {/* Events List */}
          <div className="space-y-3 overflow-y-auto max-h-[500px]">
            {isLoading ? (
              <div className="glass-card p-8 text-center text-text-secondary">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Chargement des événements...
              </div>
            ) : eventsForSelectedDay.length === 0 ? (
              <div className="glass-card p-10 rounded-2xl border border-border text-center text-text-secondary space-y-3">
                <CalendarIcon size={36} className="mx-auto opacity-20" />
                <p className="text-sm font-semibold">Aucun événement prévu ce jour-ci</p>
                <p className="text-xs max-w-xs mx-auto">
                  Votre emploi du temps est libre pour cette date.
                </p>
                {canManageCalendar && (
                  <button
                    onClick={() => handleOpenAddModal(selectedDay || undefined)}
                    className="px-4 py-2 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold transition-colors inline-flex items-center gap-1.5 mt-2"
                  >
                    <Plus size={14} /> Ajouter un créneau
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
                            className="text-text-secondary hover:text-primary p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                            title="Modifier ce cours / planning"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-text-secondary hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Supprimer ce cours / planning"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1.5 font-semibold text-primary">
                        <Clock size={13} />
                        <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                      </div>

                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        event.target_roles?.startsWith('Groupe:')
                          ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                          : 'text-text-secondary'
                      }`}>
                        {event.target_roles?.startsWith('Groupe:') ? `👥 ${event.target_roles}` : event.target_roles?.split(',').join(' • ')}
                      </span>
                    </div>
                    
                    {/* Deliverables Button */}
                    <div className="pt-2">
                      <button
                        onClick={() => setDeliverablesEvent(event)}
                        className="w-full py-1.5 rounded-lg bg-surface hover:bg-border text-white text-xs font-bold border border-border transition-colors flex items-center justify-center gap-2"
                      >
                        <ShieldCheck size={14} className="text-primary" />
                        {canManageCalendar ? "Consulter les livrables" : "Vos livrables"}
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
      {/* MODAL : PLANIFIER UN ÉVÉNEMENT / COURS                                   */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-6 rounded-3xl border border-primary/30 space-y-4 animate-fade-in-up max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <CalendarIcon size={20} />
                <h3>{editingEventId ? "Modifier le cours ou planning" : "Planifier un cours ou planning"}</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-text-secondary hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar pr-2 flex-1">
              <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
                {/* Titre */}
              <div>
                <label className="block uppercase font-bold text-text-secondary mb-1">
                  Titre de l'événement *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cours d'Intelligence Artificielle, Réunion de suivi..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block uppercase font-bold text-text-secondary mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Objectifs, ordre du jour, lien de visioconférence..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary resize-none"
                />
              </div>

              {/* Date & Heure de début */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase font-bold text-text-secondary mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                  />
                </div>
                <div>
                  <label className="block uppercase font-bold text-text-secondary mb-1">
                    Heure de début *
                  </label>
                  <input
                    type="time"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                  />
                </div>
              </div>

              {/* Date & Heure de fin */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase font-bold text-text-secondary mb-1">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                  />
                </div>
                <div>
                  <label className="block uppercase font-bold text-text-secondary mb-1">
                    Heure de fin *
                  </label>
                  <input
                    type="time"
                    required
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary"
                  />
                </div>
              </div>

              {/* Rôles cibles */}
              <div>
                <label className="block uppercase font-bold text-text-secondary mb-1">
                  Public concerné
                </label>
                <select
                  value={newRoles}
                  onChange={(e) => setNewRoles(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-primary text-text-primary cursor-pointer font-medium"
                >
                  <optgroup label="Public Général / Rôles">
                    <option value="étudiant,stagiaire,employer">Tous (Étudiants, Stagiaires, Employés)</option>
                    <option value="étudiant">Étudiants uniquement</option>
                    <option value="stagiaire">Stagiaires uniquement</option>
                    <option value="employer">Employés uniquement</option>
                    <option value="formateur,admin">Formateurs & Administration</option>
                  </optgroup>

                  {availableGroups && availableGroups.length > 0 && (
                    <optgroup label="Groupes & Classes (Ajoutés)">
                      {availableGroups.map((g) => (
                        <option key={g.id} value={`Groupe: ${g.name}`}>
                          👥 Groupe : {g.name} {g.level ? `(${g.level})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Boutons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 bg-surface hover:bg-surface-hover rounded-xl font-semibold border border-border text-text-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 btn-primary py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
                >
                  {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : editingEventId ? <CheckCircle size={15} /> : <Plus size={15} />}
                  {editingEventId ? "Sauvegarder" : "Enregistrer"}
                </button>
              </div>
            </form>
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
