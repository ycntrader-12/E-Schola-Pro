'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import {
  Inbox as InboxIcon,
  Send,
  Mail,
  FileText,
  Paperclip,
  Trash2,
  Reply,
  Forward,
  Search,
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  X,
  Plus,
  Loader2,
  FileSpreadsheet,
  Music,
  Film,
  Image as ImageIcon,
  ArrowLeft,
  ArrowRight,
  FileEdit,
  RotateCcw,
  Flag,
  AlertTriangle,
  Save,
  Layers,
  Calendar as CalendarIcon,
  ChevronDown,
  Video,
  Star,
  Tag,
  Users,
  Info,
  CheckSquare,
  Sparkles,
  RefreshCw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCheck,
  Check,
  MailOpen,
  MailCheck,
  Eye,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { InboxHeader, SearchMode } from '@/components/inbox/InboxHeader';
import { InboxSidebar, FolderType } from '@/components/inbox/InboxSidebar';
import { InboxRightDock } from '@/components/inbox/InboxRightDock';
import { GoogleAiAssistModal } from '@/components/inbox/GoogleAiAssistModal';
import { MessageComposerView } from '@/components/inbox/MessageComposerView';
import { RecipientInput } from '@/components/inbox/RecipientInput';
import { UserMinimalRead } from '@/types/recipient';

interface UserShort {
  id: number;
  email: string;
  role: string;
  avatar_url?: string;
}

interface MessageItem {
  id: number;
  sender_id: number;
  recipient_id?: number;
  subject: string;
  body: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  is_read: boolean;
  read_at?: string;
  is_starred?: boolean;
  is_draft?: boolean;
  is_trash?: boolean;
  is_reported?: boolean;
  report_reason?: string;
  is_broadcast?: boolean;
  is_welcome_msg?: boolean;
  is_relay?: boolean;
  cc_emails?: string;
  created_at: string;
  sender?: UserShort;
  recipient?: UserShort;
}

export default function InboxMessagesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const t = useTranslations('Inbox');

  const [currentUser, setCurrentUser] = useState<UserShort | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [composerInitialData, setComposerInitialData] = useState<{
    to?: UserMinimalRead[];
    subject?: string;
    body?: string;
  } | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalPrompt, setAiModalPrompt] = useState('');

  // Open integrated in-app composer directly in main panel without page reload or new tab
  const openComposer = (data?: { to?: UserMinimalRead[]; subject?: string; body?: string }) => {
    setSelectedMessage(null);
    if (data) {
      setComposerInitialData(data);
    } else {
      setComposerInitialData(null);
    }
    setIsComposing(true);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('compose', 'true');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Close composer, reset form state, and clean URL query parameter
  const closeComposer = () => {
    setIsComposing(false);
    setComposerInitialData(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('compose');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Synchronize on mount if URL contains ?compose=true or ?compose=new
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('compose') === 'true' || params.get('compose') === 'new') {
        setIsComposing(true);
      }
    }
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Messages lists
  const [inboxMessages, setInboxMessages] = useState<MessageItem[]>([]);
  const [sentMessages, setSentMessages] = useState<MessageItem[]>([]);
  const [draftMessages, setDraftMessages] = useState<MessageItem[]>([]);
  const [trashMessages, setTrashMessages] = useState<MessageItem[]>([]);
  const [starredMessages, setStarredMessages] = useState<MessageItem[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);

  // Multi-selection & Star state
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set());

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('internal');

  // Reporting Modal state
  const [reportingMessage, setReportingMessage] = useState<MessageItem | null>(null);
  const [reportReason, setReportReason] = useState<string>('Contenu inapproprié ou offensant');
  const [customReportReason, setCustomReportReason] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAllMessages = async () => {
    setIsRefreshing(true);
    try {
      const [inboxRes, sentRes, draftsRes, trashRes] = await Promise.all([
        apiClient.get('/messages/inbox').catch(() => ({ data: [] })),
        apiClient.get('/messages/sent').catch(() => ({ data: [] })),
        apiClient.get('/messages/drafts').catch(() => ({ data: [] })),
        apiClient.get('/messages/trash').catch(() => ({ data: [] })),
      ]);

      setInboxMessages(inboxRes.data || []);
      setSentMessages(sentRes.data || []);
      setDraftMessages(draftsRes.data || []);
      setTrashMessages(trashRes.data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const userRes = await apiClient.get('/users/me');
      setCurrentUser(userRes.data);
      await loadAllMessages();
    } catch (err) {
      console.error('Error fetching initial inbox data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load current user and initial messages
  useEffect(() => {
    fetchInitialData();
  }, []);

  const unreadCount = useMemo(() => {
    return inboxMessages.filter((m) => !m.is_read).length;
  }, [inboxMessages]);

  const userRole = (currentUser?.role || '').toLowerCase().trim();
  const isRestrictedRole = ['employer', 'employé', 'étudiant', 'etudiant', 'stagiaire'].includes(userRole);
  const canUseBroadcast = currentUser ? !isRestrictedRole : false;

  // Star message handler with optimistic UI and database persistence
  const handleToggleStar = async (msgId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInboxMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, is_starred: !m.is_starred } : m))
    );
    setSentMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, is_starred: !m.is_starred } : m))
    );
    setDraftMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, is_starred: !m.is_starred } : m))
    );
    if (selectedMessage && selectedMessage.id === msgId) {
      setSelectedMessage((prev) => (prev ? { ...prev, is_starred: !prev.is_starred } : null));
    }
    try {
      await apiClient.put(`/messages/${msgId}/star`);
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  // Toggle Read/Unread status handler with optimistic UI and sync
  const handleToggleRead = async (msgId: number, targetStatus: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nowIso = new Date().toISOString();
    const updateFn = (m: MessageItem) =>
      m.id === msgId
        ? { ...m, is_read: targetStatus, read_at: targetStatus ? (m.read_at || nowIso) : undefined }
        : m;

    setInboxMessages((prev) => prev.map(updateFn));
    setSentMessages((prev) => prev.map(updateFn));
    setDraftMessages((prev) => prev.map(updateFn));
    setTrashMessages((prev) => prev.map(updateFn));

    if (selectedMessage && selectedMessage.id === msgId) {
      setSelectedMessage((prev) => (prev ? updateFn(prev) : null));
    }

    try {
      if (targetStatus) {
        await apiClient.put(`/messages/${msgId}/read`);
      } else {
        await apiClient.put(`/messages/${msgId}/unread`);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('messages_updated'));
      }
    } catch (err) {
      console.error('Failed to toggle read status:', err);
    }
  };

  // Bulk Mark as Read / Unread
  const handleBulkMarkRead = async (targetStatus: boolean) => {
    if (selectedMessageIds.size === 0) return;
    const nowIso = new Date().toISOString();
    const targetIds = Array.from(selectedMessageIds);

    const updateFn = (m: MessageItem) =>
      selectedMessageIds.has(m.id)
        ? { ...m, is_read: targetStatus, read_at: targetStatus ? (m.read_at || nowIso) : undefined }
        : m;

    setInboxMessages((prev) => prev.map(updateFn));
    setSentMessages((prev) => prev.map(updateFn));
    setDraftMessages((prev) => prev.map(updateFn));
    setTrashMessages((prev) => prev.map(updateFn));

    if (selectedMessage && selectedMessageIds.has(selectedMessage.id)) {
      setSelectedMessage((prev) => (prev ? updateFn(prev) : null));
    }

    for (const msgId of targetIds) {
      try {
        if (targetStatus) {
          await apiClient.put(`/messages/${msgId}/read`);
        } else {
          await apiClient.put(`/messages/${msgId}/unread`);
        }
      } catch (err) {
        console.error(`Failed to mark read message #${msgId}:`, err);
      }
    }

    setSelectedMessageIds(new Set());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('messages_updated'));
    }
    setActionMessage({
      type: 'success',
      text: targetStatus ? 'Messages marqués comme lus.' : 'Messages marqués comme non lus.',
    });
  };

  // Get active message list based on current folder
  const currentFolderList = useMemo(() => {
    let list: MessageItem[] = [];
    if (activeFolder === 'inbox') list = inboxMessages;
    else if (activeFolder === 'all')
      list = [...inboxMessages, ...sentMessages, ...draftMessages];
    else if (activeFolder === 'sent') list = sentMessages;
    else if (activeFolder === 'drafts') list = draftMessages;
    else if (activeFolder === 'trash') list = trashMessages;
    else if (activeFolder === 'starred')
      list = [...inboxMessages, ...sentMessages, ...draftMessages].filter((m) => m.is_starred);
    else if (activeFolder === 'snoozed')
      list = inboxMessages.filter((m) => !m.is_read);
    else if (activeFolder === 'classroom')
      list = [...inboxMessages, ...sentMessages].filter(
        (m) =>
          m.is_broadcast ||
          m.subject.toLowerCase().includes('classe') ||
          m.subject.toLowerCase().includes('cours') ||
          m.subject.toLowerCase().includes('session') ||
          m.body.toLowerCase().includes('classe')
      );

    // Apply internal search filter
    if (searchMode === 'internal' && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          m.sender?.email.toLowerCase().includes(q) ||
          m.recipient?.email.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeFolder, inboxMessages, sentMessages, draftMessages, trashMessages, searchQuery, searchMode]);

  // Handle select single message
  const handleSelectMessage = async (msg: MessageItem) => {
    const nowIso = new Date().toISOString();
    setSelectedMessage(msg);

    if ((activeFolder === 'inbox' || activeFolder === 'all') && !msg.is_read) {
      try {
        await apiClient.get(`/messages/${msg.id}`);
        setInboxMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, is_read: true, read_at: m.read_at || nowIso } : m))
        );
        setSelectedMessage((prev) =>
          prev && prev.id === msg.id ? { ...prev, is_read: true, read_at: prev.read_at || nowIso } : prev
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('messages_updated'));
        }
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    }
  };

  // Reply and Forward handlers
  const handleReply = (msg: MessageItem) => {
    const senderEmail = msg.sender?.email || '';
    const replyRecipient: UserMinimalRead[] = msg.sender
      ? [
          {
            id: String(msg.sender.id),
            email: senderEmail || undefined,
            full_name: senderEmail && senderEmail.includes('@')
              ? senderEmail.split('@')[0]
              : senderEmail || `Utilisateur #${msg.sender.id}`,
            role: msg.sender.role || 'utilisateur',
            avatar_url: msg.sender.avatar_url,
          },
        ]
      : [];
    openComposer({
      to: replyRecipient,
      subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
      body: `\n\n--- Message d'origine ---\nDe : ${msg.sender?.email || 'Inconnu'}\nDate : ${new Date(msg.created_at).toLocaleString()}\n\n${msg.body}`,
    });
  };

  const handleForward = (msg: MessageItem) => {
    openComposer({
      to: [],
      subject: msg.subject.startsWith('Fwd:') ? msg.subject : `Fwd: ${msg.subject}`,
      body: `\n\n---------- Message transféré ----------\nDe : ${msg.sender?.email || 'Inconnu'}\nDate : ${new Date(msg.created_at).toLocaleString()}\nObjet : ${msg.subject}\n\n${msg.body}`,
    });
  };

  // Toggle selection checkbox for message
  const toggleSelectMessage = (msgId: number, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // Select all / Deselect all
  const toggleSelectAll = () => {
    if (selectedMessageIds.size === currentFolderList.length) {
      setSelectedMessageIds(new Set());
    } else {
      setSelectedMessageIds(new Set(currentFolderList.map((m) => m.id)));
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedMessageIds.size === 0) return;
    if (!confirm(`Supprimer les ${selectedMessageIds.size} message(s) sélectionné(s) ?`)) return;

    for (const msgId of Array.from(selectedMessageIds)) {
      try {
        await apiClient.delete(`/messages/${msgId}`);
      } catch (err) {
        console.error('Error deleting message:', err);
      }
    }

    setSelectedMessageIds(new Set());
    await loadAllMessages();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('messages_updated'));
    }
    setActionMessage({ type: 'success', text: 'Messages supprimés avec succès.' });
  };

  // Report message
  const handleSubmitReport = async () => {
    if (!reportingMessage) return;
    const finalReason = reportReason === 'Autre motif' ? customReportReason.trim() || 'Motif non précisé' : reportReason;

    setIsSubmittingReport(true);
    try {
      await apiClient.post(`/messages/${reportingMessage.id}/report`, { reason: finalReason });
      setInboxMessages((prev) =>
        prev.map((m) => (m.id === reportingMessage.id ? { ...m, is_reported: true, report_reason: finalReason } : m))
      );
      if (selectedMessage?.id === reportingMessage.id) {
        setSelectedMessage((prev) => (prev ? { ...prev, is_reported: true, report_reason: finalReason } : prev));
      }
      setReportingMessage(null);
      setCustomReportReason('');
      setActionMessage({
        type: 'success',
        text: '🚨 Signalement transmis immédiatement aux formateurs et administrateurs.',
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors du signalement.' });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-xs font-bold text-text-secondary">Chargement de ScholaPro Inbox...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans select-none">
      {/* 1. Top Header Bar (ScholaPro Logo, Multi-Mode Search, Actions) */}
      <InboxHeader
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        currentUser={currentUser}
        labels={{
          internal: t('search_mode_internal'),
          google: t('search_mode_google'),
          ai: t('search_mode_ai'),
          placeholderInternal: t('search_placeholder_internal'),
          placeholderGoogle: t('search_placeholder_google'),
          placeholderAi: t('search_placeholder_ai'),
        }}
      />

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border-b border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-b border-rose-500/30'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)} className="hover:opacity-80">
            ✕
          </button>
        </div>
      )}

      {/* 2. Main Container (Sidebar + Content Panel + Right Dock) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <InboxSidebar
          activeFolder={activeFolder}
          onSelectFolder={(folder) => {
            setActiveFolder(folder);
            setSelectedMessage(null);
            setIsComposing(false);
            setSelectedMessageIds(new Set());
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('compose');
              window.history.replaceState({}, '', url.toString());
            }
          }}
          onOpenCompose={() => openComposer()}
          onNavigateCalendar={() => router.push('/calendar')}
          onNavigateClassroom={() => {
            setActiveFolder('classroom');
            setSelectedMessage(null);
            setIsComposing(false);
            setSelectedMessageIds(new Set());
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('compose');
              window.history.replaceState({}, '', url.toString());
            }
          }}
          unreadCount={unreadCount}
          draftsCount={draftMessages.length}
          starredCount={[...inboxMessages, ...sentMessages].filter((m) => m.is_starred).length}
          allCount={inboxMessages.length + sentMessages.length + draftMessages.length}
          isCollapsed={isSidebarCollapsed}
          canUseBroadcast={canUseBroadcast}
          labels={{
            compose: t('compose'),
            inbox: t('inbox'),
            allMail: t('all_mail'),
            starred: t('starred'),
            snoozed: t('snoozed'),
            sent: t('sent'),
            drafts: t('drafts'),
            classroom: t('classroom'),
            trash: t('trash'),
            calendar: t('calendar'),
          }}
        />

        {/* Center Main Panel (Message List OR Detail View OR In-App Integrated Composer) */}
        <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
          {isComposing ? (
            /* IN-APP INTEGRATED RECTANGULAR COMPOSER & POST-SAVE SUMMARY CARD */
            <MessageComposerView
              onClose={closeComposer}
              onSuccess={() => {
                loadAllMessages();
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new Event('messages_updated'));
                }
                setActionMessage({ type: 'success', text: 'Message enregistré avec succès !' });
              }}
              initialToRecipients={composerInitialData?.to}
              initialSubject={composerInitialData?.subject}
              initialBody={composerInitialData?.body}
            />
          ) : selectedMessage ? (
            /* MESSAGE DETAIL VIEW */
            (() => {
              const isSender = selectedMessage.sender_id === currentUser?.id || activeFolder === 'sent';
              const isRecipient = selectedMessage.recipient_id === currentUser?.id;

              return (
                <div className="flex-1 p-6 overflow-y-auto space-y-6 animate-fade-in-up">
                  {/* Header Actions */}
                  <div className="flex items-center justify-between pb-4 border-b border-border flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMessage(null)}
                      className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 font-semibold"
                    >
                      <ArrowLeft size={16} /> Retour à la liste
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Mark Read/Unread Toggle */}
                      {isRecipient && (
                        <button
                          type="button"
                          onClick={() => handleToggleRead(selectedMessage.id, !selectedMessage.is_read)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                            selectedMessage.is_read
                              ? 'bg-surface hover:bg-surface-hover border-border text-text-secondary hover:text-text-primary'
                              : 'bg-primary/15 hover:bg-primary/25 border-primary/30 text-primary font-bold'
                          }`}
                        >
                          {selectedMessage.is_read ? (
                            <>
                              <Mail size={14} /> <span>{t('mark_unread') || 'Marquer non lu'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCheck size={14} className="text-sky-400" /> <span>{t('mark_as_read') || 'Marquer lu'}</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleReply(selectedMessage)}
                        className="px-3 py-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Reply size={14} /> Répondre
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAiModalPrompt(`Résume le message suivant :\nSujet: ${selectedMessage.subject}\nCorps: ${selectedMessage.body}`);
                          setIsAiModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles size={14} /> Résumé par IA Gemini
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStar(selectedMessage.id)}
                        className="p-2 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-secondary transition-colors"
                      >
                        <Star size={16} className={selectedMessage.is_starred ? 'text-amber-400 fill-amber-400' : ''} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setReportingMessage(selectedMessage)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Flag size={14} /> Signaler
                      </button>
                    </div>
                  </div>

                  {/* Accusé de Réception / Read Receipt Status Card */}
                  {isSender ? (
                    <div
                      className={`p-4 rounded-2xl border transition-all ${
                        selectedMessage.is_read
                          ? 'bg-gradient-to-r from-sky-500/15 via-blue-500/5 to-transparent border-sky-500/30 text-sky-400 shadow-sm'
                          : 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30 text-amber-400 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                              selectedMessage.is_read
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {selectedMessage.is_read ? (
                              <CheckCheck size={24} className="text-sky-400" />
                            ) : (
                              <Clock size={20} className="text-amber-400 animate-pulse" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-text-primary">
                                {selectedMessage.is_read
                                  ? (t('read_receipt_confirmed') || 'Accusé de lecture confirmé')
                                  : (t('read_receipt_pending') || 'En attente de lecture')}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                  selectedMessage.is_read
                                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                }`}
                              >
                                {selectedMessage.is_read ? '✓✓ Lu' : '⏳ Distribué'}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                              {selectedMessage.is_read ? (
                                <>
                                  Ce message a été ouvert et lu par le destinataire (
                                  <strong className="text-text-primary">
                                    {selectedMessage.recipient?.email || 'Destinataire'}
                                  </strong>
                                  )
                                  {selectedMessage.read_at && (
                                    <>
                                      {' '}le{' '}
                                      <strong className="text-text-primary">
                                        {new Date(selectedMessage.read_at).toLocaleString()}
                                      </strong>
                                    </>
                                  )}
                                  .
                                </>
                              ) : (
                                <>
                                  Le message a été distribué à la boîte de réception de{' '}
                                  <strong className="text-text-primary">
                                    {selectedMessage.recipient?.email || 'Destinataire'}
                                  </strong>
                                  . L'accusé de lecture s'activera dès son ouverture.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-surface/40 border border-border text-xs">
                      <div className="flex items-center gap-2 text-text-secondary">
                        <CheckCheck size={16} className="text-sky-400" />
                        <span>
                          {selectedMessage.read_at
                            ? `Message lu le ${new Date(selectedMessage.read_at).toLocaleString()}`
                            : 'Message ouvert et lu'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleRead(selectedMessage.id, false)}
                        className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Mail size={13} /> {t('mark_unread') || 'Marquer comme non lu'}
                      </button>
                    </div>
                  )}

                  {/* Virtual Classroom Invitation Action Banner */}
                  {(selectedMessage.subject?.toLowerCase().includes('invitation salle vidéo conférence') ||
                    selectedMessage.subject?.toLowerCase().includes('invitation classe virtuelle') ||
                    selectedMessage.body?.toLowerCase().includes('code de la salle')) && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <Video size={16} />
                        <span>Invitation Directe à la Salle vidéo conférence</span>
                      </div>
                      <p className="text-xs text-text-secondary">
                        Vous pouvez accepter cette invitation et rejoindre la session en direct immédiatement depuis l'espace des Salles vidéo conférence.
                      </p>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => router.push('/classroom')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-colors"
                        >
                          <CheckCircle2 size={14} /> Accepter &amp; Accéder à la Salle vidéo conférence
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {selectedMessage.attachment_url && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                        <Paperclip size={14} className="text-primary" /> Pièce Jointe
                      </h4>
                      {(() => {
                        const cleanUrl = (selectedMessage.attachment_url || '').trim().toLowerCase();
                        const isSafe =
                          cleanUrl.startsWith('http://') ||
                          cleanUrl.startsWith('https://') ||
                          cleanUrl.startsWith('/uploads/') ||
                          (cleanUrl.startsWith('data:image/') && cleanUrl.includes(';base64,'));

                        if (!isSafe) {
                          return (
                            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
                              <AlertTriangle size={15} />
                              <span>Pièce jointe désactivée par mesure de sécurité (protocole ou URL non sécurisé).</span>
                            </div>
                          );
                        }

                        return (
                          <a
                            href={selectedMessage.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            download={selectedMessage.attachment_name}
                            className="flex items-center justify-between p-3.5 bg-surface hover:bg-surface-hover rounded-xl border border-border transition-colors"
                          >
                            <span className="text-xs font-bold text-text-primary truncate">
                              {selectedMessage.attachment_name || 'Fichier joint'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                              <Download size={14} /> Télécharger
                            </span>
                          </a>
                        );
                      })()}
                    </div>
                  )}

                  {/* Reply and Forward Quick Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => handleReply(selectedMessage)}
                      className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/25 hover:bg-primary-hover transition-colors"
                    >
                      <Reply size={15} /> Répondre
                    </button>
                    <button
                      type="button"
                      onClick={() => handleForward(selectedMessage)}
                      className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Forward size={15} /> Transférer
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            /* MAIN MESSAGES LIST VIEW WITH GMAIL LAYOUT */
            <div className="flex-1 flex flex-col min-h-0">
              {/* 1. Gmail-Style Action Toolbar */}
              <div className="px-4 py-3 border-b border-border/80 flex items-center justify-between bg-background/50 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {/* Select All Checkbox */}
                  <input
                    type="checkbox"
                    checked={
                      currentFolderList.length > 0 &&
                      selectedMessageIds.size === currentFolderList.length
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={loadAllMessages}
                    disabled={isRefreshing}
                    className="p-2 rounded-xl hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
                    title={t('refresh') || 'Actualiser'}
                  >
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-primary' : ''} />
                  </button>

                  {/* Bulk Actions when selected */}
                  {selectedMessageIds.size > 0 && (
                    <div className="flex items-center gap-1.5 animate-fade-in">
                      <button
                        type="button"
                        onClick={() => handleBulkMarkRead(true)}
                        className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={t('mark_as_read') || 'Marquer comme lu'}
                      >
                        <CheckCheck size={14} className="text-sky-400" />
                        <span className="hidden sm:inline">{t('mark_as_read') || 'Marquer lu'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBulkMarkRead(false)}
                        className="px-2.5 py-1.5 rounded-xl bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={t('mark_unread') || 'Marquer comme non lu'}
                      >
                        <Mail size={14} />
                        <span className="hidden sm:inline">{t('mark_unread') || 'Marquer non lu'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBulkDelete}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title={t('delete_msg') || 'Supprimer la sélection'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Pagination Info */}
                <div className="flex items-center gap-3 text-xs text-text-secondary font-medium">
                  <span>
                    1-{currentFolderList.length} sur {currentFolderList.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-1 rounded hover:bg-surface text-text-secondary" disabled>
                      <ChevronLeft size={16} />
                    </button>
                    <button type="button" className="p-1 rounded hover:bg-surface text-text-secondary" disabled>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Salle Vidéo Conférence Banner */}
              {activeFolder === 'classroom' && (
                <div className="mx-4 my-3 p-4 rounded-2xl bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-primary/10 border border-blue-500/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Video size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-text-primary">Espace Salles vidéo conférence HD</h3>
                      <p className="text-[11px] text-text-secondary">
                        Rejoignez vos sessions interactives en salle vidéo conférence HD avec les enseignants et les apprenants.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/classroom')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
                  >
                    <span>Ouvrir Salle vidéo conférence</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* 3. Messages List Table */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {currentFolderList.length === 0 ? (
                  <div className="py-24 text-center text-text-secondary text-xs space-y-2">
                    <Mail size={40} className="mx-auto opacity-30" />
                    <p className="font-semibold">{t('no_messages')}</p>
                  </div>
                ) : (
                  currentFolderList.map((msg) => {
                    const isSelected = selectedMessageIds.has(msg.id);
                    const isSentFolder = activeFolder === 'sent' || msg.sender_id === currentUser?.id;
                    const displayName = isSentFolder
                      ? msg.recipient?.email
                        ? `À: ${msg.recipient.email.split('@')[0]}`
                        : msg.recipient_id ? `À: Utilisateur #${msg.recipient_id}` : 'À: Tous'
                      : msg.sender?.email
                        ? msg.sender.email.split('@')[0]
                        : 'Utilisateur';

                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectMessage(msg)}
                        className={`px-4 py-3 cursor-pointer flex items-center justify-between gap-4 transition-all group hover:bg-surface/80 ${
                          !msg.is_read && !isSentFolder ? 'bg-primary/5 font-extrabold' : 'bg-transparent'
                        } ${isSelected ? 'bg-primary/15' : ''}`}
                      >
                        {/* Checkbox & Star */}
                        <div
                          className="flex items-center gap-3 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectMessage(msg.id, e)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />

                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(msg.id, e)}
                            className="text-text-secondary hover:text-amber-400 transition-colors p-1 cursor-pointer"
                          >
                            <Star
                              size={16}
                              className={msg.is_starred ? 'text-amber-400 fill-amber-400' : ''}
                            />
                          </button>
                        </div>

                        {/* Sender/Recipient Display */}
                        <div className="w-44 shrink-0 flex items-center gap-2 truncate">
                          {!isSentFolder && !msg.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                          )}
                          <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            {displayName.replace('À: ', '').charAt(0).toUpperCase()}
                          </div>
                          <span className={`text-xs truncate ${!msg.is_read && !isSentFolder ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'}`}>
                            {displayName}
                          </span>
                        </div>

                        {/* Subject + Body Snippet Preview */}
                        <div className="flex-1 min-w-0 truncate text-xs flex items-center gap-2">
                          {msg.is_reported && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center gap-1 shrink-0">
                              <Flag size={10} /> {t('reported_badge') || 'Signalé'}
                            </span>
                          )}
                          <span className={`truncate ${!msg.is_read && !isSentFolder ? 'font-bold text-text-primary' : 'font-semibold text-text-primary'}`}>
                            {msg.subject}
                          </span>
                          <span className="text-text-secondary/60 truncate font-normal">
                            — {msg.body}
                          </span>
                        </div>

                        {/* Read Receipt Badge for Sent Messages */}
                        {isSentFolder && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            {msg.is_read ? (
                              <div
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[11px] font-bold shadow-xs"
                                title={
                                  msg.read_at
                                    ? `Accusé de lecture : Lu par le destinataire le ${new Date(msg.read_at).toLocaleString()}`
                                    : 'Accusé de lecture confirmé (Message lu)'
                                }
                              >
                                <CheckCheck size={14} className="text-sky-400" />
                                <span className="hidden md:inline">Lu</span>
                              </div>
                            ) : (
                              <div
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface/80 border border-border text-text-secondary text-[11px] font-medium"
                                title="Accusé de lecture : En attente d'ouverture par le destinataire"
                              >
                                <Check size={13} className="text-text-secondary" />
                                <span className="hidden md:inline">Non lu</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hover Quick Actions & Attachment & Date */}
                        <div className="flex items-center gap-2 shrink-0 text-xs text-text-secondary">
                          <div
                            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Toggle Read/Unread quick button */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleRead(msg.id, !msg.is_read, e)}
                              className="p-1 rounded-lg hover:bg-primary/15 text-text-secondary hover:text-primary transition-colors cursor-pointer"
                              title={msg.is_read ? (t('mark_unread') || 'Marquer comme non lu') : (t('mark_as_read') || 'Marquer comme lu')}
                            >
                              {msg.is_read ? <Mail size={13} /> : <CheckCheck size={13} className="text-sky-400" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setReportingMessage(msg)}
                              className="p-1 rounded-lg hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 transition-colors cursor-pointer"
                              title="Signaler ce message"
                            >
                              <Flag size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiClient.delete(`/messages/${msg.id}`);
                                  await loadAllMessages();
                                } catch (err) {
                                  console.error('Failed to delete message:', err);
                                }
                              }}
                              className="p-1 rounded-lg hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 transition-colors cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          {msg.attachment_url && (
                            <Paperclip size={14} className="text-primary shrink-0" />
                          )}
                          <span className="text-[11px] font-medium font-mono">
                            {new Date(msg.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </main>

        {/* Right Collapsible Utilities Dock (Calendar, Tasks, Gemini AI, Contacts) */}
        <InboxRightDock onOpenAiModal={() => setIsAiModalOpen(true)} />
      </div>

      {/* Google AI Gemini Assistant Modal */}
      <GoogleAiAssistModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialPrompt={aiModalPrompt}
      />

      {/* 4. Interactive Report Message Modal */}
      {reportingMessage && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-lg w-full p-6 rounded-3xl border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-900 dark:text-slate-100 shadow-2xl space-y-4 animate-fade-in-up">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                  <Flag size={20} className="text-rose-500 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-text-primary">
                    {t('report_modal_title') || 'Signaler ce message'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-text-secondary">
                    {t('report_modal_subtitle') || 'Ce signalement sera transmis immédiatement aux administrateurs et au formateur de votre groupe.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReportingMessage(null);
                  setCustomReportReason('');
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-surface text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Message Context */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-surface/60 border border-slate-200 dark:border-border text-xs space-y-1">
              <div className="font-semibold text-slate-800 dark:text-text-primary truncate">
                📌 <span className="font-bold">Objet :</span> {reportingMessage.subject}
              </div>
              <div className="text-slate-500 dark:text-text-secondary truncate">
                👤 <span className="font-bold">De :</span> {reportingMessage.sender?.email || 'Inconnu'}
              </div>
            </div>

            {/* Reason Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-text-secondary">
                Motif du signalement
              </label>
              <div className="space-y-1.5">
                {[
                  { id: 'inappropriate', label: t('report_reason_inappropriate') || 'Contenu inapproprié ou offensant' },
                  { id: 'harassment', label: t('report_reason_harassment') || 'Harcèlement, intimidation ou propos abusifs' },
                  { id: 'spam', label: t('report_reason_spam') || 'Spam, arnaque ou publicité non sollicitée' },
                  { id: 'privacy', label: t('report_reason_privacy') || 'Divulgation d\'informations confidentielles' },
                  { id: 'other', label: t('report_reason_other') || 'Autre motif (à préciser)' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer text-xs font-medium transition-all ${
                      reportReason === opt.label
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                        : 'bg-white dark:bg-surface/40 border-slate-200 dark:border-border text-slate-700 dark:text-text-primary hover:bg-slate-50 dark:hover:bg-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReasonOption"
                      checked={reportReason === opt.label}
                      onChange={() => setReportReason(opt.label)}
                      className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom reason input */}
            {reportReason === (t('report_reason_other') || 'Autre motif (à préciser)') && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-xs font-bold text-slate-700 dark:text-text-secondary">
                  Précisez votre motif
                </label>
                <textarea
                  value={customReportReason}
                  onChange={(e) => setCustomReportReason(e.target.value)}
                  placeholder="Expliquez brièvement la raison de votre signalement..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-border bg-white dark:bg-surface text-xs text-slate-900 dark:text-text-primary outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all resize-none"
                />
              </div>
            )}

            {/* Routing Alert Notice */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Ce signalement sera transmis directement aux <strong>administrateurs</strong> et au <strong>formateur</strong> de votre groupe.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-border">
              <button
                type="button"
                onClick={() => {
                  setReportingMessage(null);
                  setCustomReportReason('');
                }}
                disabled={isSubmittingReport}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-surface hover:bg-slate-200 dark:hover:bg-surface-hover text-slate-700 dark:text-text-primary text-xs font-bold transition-colors cursor-pointer"
              >
                {t('report_cancel') || 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReport ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Transmission...</span>
                  </>
                ) : (
                  <>
                    <Flag size={14} />
                    <span>{t('report_submit') || 'Confirmer le signalement'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
