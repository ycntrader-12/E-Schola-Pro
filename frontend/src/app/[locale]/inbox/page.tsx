'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { InboxHeader, SearchMode } from '@/components/inbox/InboxHeader';
import { InboxSidebar, FolderType } from '@/components/inbox/InboxSidebar';
import { InboxRightDock } from '@/components/inbox/InboxRightDock';
import { GoogleAiAssistModal } from '@/components/inbox/GoogleAiAssistModal';
import { MessageComposerModal } from '@/components/inbox/MessageComposerModal';
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
  const [isComposingModalOpen, setIsComposingModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalPrompt, setAiModalPrompt] = useState('');

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

  // Load current user and initial messages
  useEffect(() => {
    fetchInitialData();
  }, []);

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

  const unreadCount = useMemo(() => {
    return inboxMessages.filter((m) => !m.is_read).length;
  }, [inboxMessages]);

  const userRole = (currentUser?.role || '').toLowerCase().trim();
  const isRestrictedRole = ['employer', 'employé', 'étudiant', 'etudiant', 'stagiaire'].includes(userRole);
  const canUseBroadcast = currentUser ? !isRestrictedRole : false;

  // Star message handler
  const handleToggleStar = (msgId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInboxMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, is_starred: !m.is_starred } : m))
    );
    setSentMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, is_starred: !m.is_starred } : m))
    );
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
      list = [...inboxMessages, ...sentMessages].filter((m) => m.is_starred);
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
    setSelectedMessage(msg);

    if ((activeFolder === 'inbox' || activeFolder === 'all') && !msg.is_read) {
      try {
        await apiClient.get(`/messages/${msg.id}`);
        setInboxMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m))
        );
        setSelectedMessage((prev) => (prev && prev.id === msg.id ? { ...prev, is_read: true } : prev));
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    }
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
            setSelectedMessageIds(new Set());
          }}
          onOpenCompose={() => setIsComposingModalOpen(true)}
          onNavigateCalendar={() => router.push(`/${locale}/calendar`)}
          onNavigateClassroom={() => {
            setActiveFolder('classroom');
            setSelectedMessage(null);
            setSelectedMessageIds(new Set());
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

        {/* Center Main Panel (Message List OR Detail View) */}
        <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
          {selectedMessage ? (
            /* MESSAGE DETAIL VIEW */
            <div className="flex-1 p-6 overflow-y-auto space-y-6 animate-fade-in-up">
              {/* Header Actions */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={16} /> Retour à la liste
                </button>

                <div className="flex items-center gap-2">
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

              {/* Subject Title */}
              <div>
                <h1 className="text-xl font-bold text-text-primary leading-snug">{selectedMessage.subject}</h1>
                <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                  <Clock size={13} />
                  <span>{new Date(selectedMessage.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Sender & Recipient Box */}
              <div className="p-4 rounded-2xl bg-surface/60 border border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                    {(selectedMessage.sender?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary">
                      De : {selectedMessage.sender?.email || 'Utilisateur'}
                    </p>
                    <p className="text-[11px] text-text-secondary">
                      À : {selectedMessage.recipient?.email || 'Vous'}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  {selectedMessage.sender?.role || 'Utilisateur'}
                </span>
              </div>

              {/* Message Body */}
              <div className="p-5 rounded-2xl bg-surface/30 border border-border text-sm leading-relaxed whitespace-pre-wrap text-text-primary min-h-[160px]">
                {selectedMessage.body}
              </div>

              {/* Attachments */}
              {selectedMessage.attachment_url && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                    <Paperclip size={14} className="text-primary" /> Pièce Jointe
                  </h4>
                  <a
                    href={selectedMessage.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
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
                </div>
              )}
            </div>
          ) : (
            /* MAIN MESSAGES LIST VIEW WITH GMAIL LAYOUT */
            <div className="flex-1 flex flex-col min-h-0">
              {/* 1. Gmail-Style Action Toolbar */}
              <div className="px-4 py-3 border-b border-border/80 flex items-center justify-between bg-background/50">
                <div className="flex items-center gap-3">
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
                    title="Actualiser"
                  >
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-primary' : ''} />
                  </button>

                  {/* Bulk Delete */}
                  {selectedMessageIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                      title="Supprimer la sélection"
                    >
                      <Trash2 size={16} />
                    </button>
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

              {/* Classe Virtuelle Classroom HD Banner */}
              {activeFolder === 'classroom' && (
                <div className="mx-4 my-3 p-4 rounded-2xl bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-primary/10 border border-blue-500/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Video size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-text-primary">Espace Classes Virtuelles HD</h3>
                      <p className="text-[11px] text-text-secondary">
                        Rejoignez vos sessions interactives en visioconférence HD avec les enseignants et les apprenants.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/classroom`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
                  >
                    <span>Ouvrir Classroom</span>
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
                    const senderName = msg.sender?.email ? msg.sender.email.split('@')[0] : 'Utilisateur';

                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectMessage(msg)}
                        className={`px-4 py-3 cursor-pointer flex items-center justify-between gap-4 transition-all group hover:bg-surface/80 ${
                          !msg.is_read ? 'bg-primary/5 font-extrabold' : 'bg-transparent'
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
                            className="text-text-secondary hover:text-amber-400 transition-colors p-1"
                          >
                            <Star
                              size={16}
                              className={msg.is_starred ? 'text-amber-400 fill-amber-400' : ''}
                            />
                          </button>
                        </div>

                        {/* Sender Name */}
                        <div className="w-44 shrink-0 flex items-center gap-2 truncate">
                          <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                          <span className={`text-xs truncate ${!msg.is_read ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'}`}>
                            {senderName}
                          </span>
                        </div>

                        {/* Subject + Body Snippet Preview */}
                        <div className="flex-1 min-w-0 truncate text-xs flex items-center gap-2">
                          <span className={`truncate ${!msg.is_read ? 'font-bold text-text-primary' : 'font-semibold text-text-primary'}`}>
                            {msg.subject}
                          </span>
                          <span className="text-text-secondary/60 truncate font-normal">
                            — {msg.body}
                          </span>
                        </div>

                        {/* Attachment indicator & Date */}
                        <div className="flex items-center gap-3 shrink-0 text-xs text-text-secondary">
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

      {/* Recipient Multi-Select Compose Modal */}
      <MessageComposerModal
        isOpen={isComposingModalOpen}
        onClose={() => setIsComposingModalOpen(false)}
        onSuccess={() => {
          loadAllMessages();
          setActionMessage({ type: 'success', text: 'Message envoyé avec succès !' });
        }}
      />

      {/* Google AI Gemini Assistant Modal */}
      <GoogleAiAssistModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialPrompt={aiModalPrompt}
      />
    </div>
  );
}
