'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
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
  Video
} from 'lucide-react';
import { apiClient } from '@/lib/api';

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentUser, setCurrentUser] = useState<UserShort | null>(null);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'unread' | 'all' | 'sent' | 'drafts' | 'trash'>('inbox');
  const [isComposing, setIsComposing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Messages lists
  const [inboxMessages, setInboxMessages] = useState<MessageItem[]>([]);
  const [sentMessages, setSentMessages] = useState<MessageItem[]>([]);
  const [draftMessages, setDraftMessages] = useState<MessageItem[]>([]);
  const [trashMessages, setTrashMessages] = useState<MessageItem[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [allUsers, setAllUsers] = useState<UserShort[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  // Compose Form state
  const [recipientId, setRecipientId] = useState<string>('');
  const [recipientSearchText, setRecipientSearchText] = useState('');
  const [isRecipientDropdownOpen, setIsRecipientDropdownOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [ccEmailsInput, setCcEmailsInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const userRole = (currentUser?.role || '').toLowerCase().trim();
  const isRestrictedRole = ['employer', 'employé', 'étudiant', 'etudiant', 'stagiaire'].includes(userRole);
  const canUseBroadcast = currentUser ? !isRestrictedRole : false;

  // Reporting Modal state
  const [reportingMessage, setReportingMessage] = useState<MessageItem | null>(null);
  const [reportReason, setReportReason] = useState('Contenu inapproprié ou suspect');
  const [customReportReason, setCustomReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Notification feedback
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch All Data
  const loadAllMessages = async () => {
    try {
      const [inboxRes, sentRes, draftsRes, trashRes] = await Promise.all([
        apiClient.get('/messages/inbox'),
        apiClient.get('/messages/sent'),
        apiClient.get('/messages/drafts'),
        apiClient.get('/messages/trash')
      ]);
      setInboxMessages(inboxRes.data);
      setSentMessages(sentRes.data);
      setDraftMessages(draftsRes.data);
      setTrashMessages(trashRes.data);
    } catch (err) {
      console.error('Error fetching messages lists', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const meRes = await apiClient.get('/users/me');
        setCurrentUser(meRes.data);
        await loadAllMessages();

        try {
          const usersRes = await apiClient.get('/users/');
          setAllUsers(usersRes.data);
        } catch {
          // Non-admin fallback
        }
      } catch (err) {
        console.error('Failed to init messages page', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [router]);

  // Sync recipient search text when recipientId changes externally (e.g. reply, forward, broadcast)
  useEffect(() => {
    if (recipientId === '-1') {
      setRecipientSearchText('📢 Tous les utilisateurs (Envoi Général - Broadcast)');
    } else if (recipientId && allUsers.length > 0) {
      const user = allUsers.find(u => u.id.toString() === recipientId);
      if (user) {
        setRecipientSearchText(`${user.email} (${user.role.toUpperCase()})`);
      }
    } else if (!recipientId) {
      setRecipientSearchText('');
    }
  }, [recipientId, allUsers]);

  // 2. Select & Read Message
  const handleSelectMessage = async (msg: MessageItem) => {
    // If selecting a draft, open it in compose mode immediately
    if (activeFolder === 'drafts') {
      setRecipientId(msg.recipient_id?.toString() || '');
      setSubject(msg.subject === '(Sans objet)' ? '' : msg.subject);
      setBody(msg.body);
      if (msg.attachment_url) {
        setExistingAttachment({
          url: msg.attachment_url,
          name: msg.attachment_name || 'Pièce jointe',
          type: msg.attachment_type || 'document'
        });
      } else {
        setExistingAttachment(null);
      }
      setAttachedFile(null);
      setIsComposing(true);
      setSelectedMessage(null);
      return;
    }

    setSelectedMessage(msg);
    setIsComposing(false);

    if ((activeFolder === 'inbox' || activeFolder === 'unread') && !msg.is_read) {
      try {
        await apiClient.get(`/messages/${msg.id}`);
        setInboxMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
        setSelectedMessage(prev => prev && prev.id === msg.id ? { ...prev, is_read: true } : prev);
      } catch (err) {
        console.error('Error marking as read', err);
      }
    }
  };

  // 3. Delete Message (Trash or Permanent)
  const handleDeleteMessage = async (msgId: number) => {
    const isPermanent = activeFolder === 'trash';
    const confirmMsg = isPermanent 
      ? 'Supprimer définitivement ce message ? Cette action est irréversible.' 
      : 'Déplacer ce message vers la corbeille ?';

    if (!confirm(confirmMsg)) return;

    try {
      const res = await apiClient.delete(`/messages/${msgId}`);
      if (isPermanent) {
        setTrashMessages(prev => prev.filter(m => m.id !== msgId));
      } else {
        // Move from current folder to trash
        if (activeFolder === 'inbox' || activeFolder === 'unread') setInboxMessages(prev => prev.filter(m => m.id !== msgId));
        if (activeFolder === 'sent') setSentMessages(prev => prev.filter(m => m.id !== msgId));
        if (activeFolder === 'drafts') setDraftMessages(prev => prev.filter(m => m.id !== msgId));
        // Refresh trash list
        const trashRes = await apiClient.get('/messages/trash');
        setTrashMessages(trashRes.data);
      }

      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
      setActionMessage({ type: 'success', text: res.data.message });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de la suppression.' });
    }
  };

  // 4. Restore Message from Trash
  const handleRestoreMessage = async (msgId: number) => {
    try {
      const res = await apiClient.put(`/messages/${msgId}/restore`);
      setTrashMessages(prev => prev.filter(m => m.id !== msgId));
      await loadAllMessages();
      setSelectedMessage(null);
      setActionMessage({ type: 'success', text: res.data.message });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de la restauration.' });
    }
  };

  // 5. Quick Reply
  const handleReply = (msg: MessageItem) => {
    setIsComposing(true);
    setSelectedMessage(null);
    setRecipientId(msg.sender?.id?.toString() || '');
    setSubject(msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
    setBody(`\n\n--- En réponse à ${msg.sender?.email} le ${new Date(msg.created_at).toLocaleDateString()} :\n> ${msg.body}`);
    setAttachedFile(null);
    setExistingAttachment(null);
  };

  // 6. Forward Message (Transférer)
  const handleForward = (msg: MessageItem) => {
    setIsComposing(true);
    setSelectedMessage(null);
    setRecipientId('');
    setSubject(msg.subject.startsWith('Fwd:') ? msg.subject : `Fwd: ${msg.subject}`);
    setBody(`\n\n--- Message transféré de ${msg.sender?.email || 'un utilisateur'} (le ${new Date(msg.created_at).toLocaleString()}) ---\n${msg.body}`);
    
    // Preserve existing attachment if any
    if (msg.attachment_url) {
      setExistingAttachment({
        url: msg.attachment_url,
        name: msg.attachment_name || 'Pièce jointe',
        type: msg.attachment_type || 'document'
      });
    } else {
      setExistingAttachment(null);
    }
    setAttachedFile(null);
  };

  // 7. Save Draft
  const handleSaveDraft = async () => {
    if (!subject.trim() && !body.trim()) {
      setActionMessage({ type: 'error', text: 'Veuillez saisir au moins un objet ou du texte pour enregistrer un brouillon.' });
      return;
    }

    setIsSavingDraft(true);
    setActionMessage(null);

    let attachment_url = existingAttachment?.url;
    let attachment_name = existingAttachment?.name;
    let attachment_type = existingAttachment?.type;

    if (attachedFile) {
      try {
        const formData = new FormData();
        formData.append('file', attachedFile);
        const uploadRes = await apiClient.post('/upload/chat-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        attachment_url = uploadRes.data.url;
        attachment_name = uploadRes.data.filename;
        attachment_type = uploadRes.data.category;
      } catch (err) {
        console.error('Draft attachment upload error', err);
      }
    }

    try {
      const ccList = ccEmailsInput ? ccEmailsInput.split(',').map(s => s.trim()).filter(Boolean) : [];
      const res = await apiClient.post('/messages/', {
        recipient_id: recipientId && recipientId !== '-1' ? parseInt(recipientId) : undefined,
        subject: subject.trim() || '(Brouillon sans titre)',
        body: body.trim(),
        attachment_url,
        attachment_name,
        attachment_type,
        is_draft: true,
        is_broadcast: recipientId === '-1',
        cc_emails: ccList,
      });

      setDraftMessages(prev => [res.data, ...prev]);
      setIsComposing(false);
      setSubject('');
      setBody('');
      setRecipientId('');
      setRecipientSearchText('');
      setCcEmailsInput('');
      setAttachedFile(null);
      setExistingAttachment(null);
      setActiveFolder('drafts');
      setActionMessage({ type: 'success', text: 'Brouillon enregistré avec succès.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || "Erreur lors de l'enregistrement du brouillon." });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // 8. Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const isBroadcastSend = recipientId === '-1';
    if ((!recipientId && !isBroadcastSend) || !subject.trim() || !body.trim()) {
      setActionMessage({ type: 'error', text: 'Veuillez renseigner le destinataire, l’objet et le message.' });
      return;
    }

    setIsSending(true);
    setActionMessage(null);

    let attachment_url = existingAttachment?.url;
    let attachment_name = existingAttachment?.name;
    let attachment_type = existingAttachment?.type;

    // Upload attachment if a new file was chosen
    if (attachedFile) {
      try {
        const formData = new FormData();
        formData.append('file', attachedFile);
        const uploadRes = await apiClient.post('/upload/chat-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        attachment_url = uploadRes.data.url;
        attachment_name = uploadRes.data.filename;
        attachment_type = uploadRes.data.category;
      } catch (err: any) {
        console.error('Attachment upload failed', err);
        setActionMessage({ type: 'error', text: err?.response?.data?.detail || "Échec de l'envoi de la pièce jointe." });
        setIsSending(false);
        return;
      }
    }

    try {
      const ccList = ccEmailsInput ? ccEmailsInput.split(',').map(s => s.trim()).filter(Boolean) : [];
      const res = await apiClient.post('/messages/', {
        recipient_id: isBroadcastSend ? -1 : parseInt(recipientId),
        subject: subject.trim(),
        body: body.trim(),
        attachment_url,
        attachment_name,
        attachment_type,
        is_draft: false,
        is_broadcast: isBroadcastSend,
        cc_emails: ccList,
      });

      setSentMessages(prev => [res.data, ...prev]);
      setIsComposing(false);
      setSubject('');
      setBody('');
      setRecipientId('');
      setRecipientSearchText('');
      setCcEmailsInput('');
      setAttachedFile(null);
      setExistingAttachment(null);
      setActiveFolder('sent');
      setSelectedMessage(res.data);
      setActionMessage({
        type: 'success',
        text: isBroadcastSend
          ? '📢 Envoi général (Broadcast) transmis avec succès à l’ensemble des utilisateurs !'
          : `Message envoyé avec succès à ${res.data.recipient?.email || 'votre correspondant'}.`
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || "Erreur lors de l'envoi du message." });
    } finally {
      setIsSending(false);
    }
  };

  // 9. Report Message to Instructors and Admins (Signalement Direct)
  const handleSubmitReport = async () => {
    if (!reportingMessage) return;

    const finalReason = reportReason === 'Autre motif' ? (customReportReason.trim() || 'Motif non précisé') : reportReason;

    setIsSubmittingReport(true);
    try {
      const res = await apiClient.post(`/messages/${reportingMessage.id}/report`, {
        reason: finalReason
      });

      // Update local state to show reported badge
      setInboxMessages(prev => prev.map(m => m.id === reportingMessage.id ? { ...m, is_reported: true, report_reason: finalReason } : m));
      if (selectedMessage?.id === reportingMessage.id) {
        setSelectedMessage(prev => prev ? { ...prev, is_reported: true, report_reason: finalReason } : prev);
      }

      setReportingMessage(null);
      setCustomReportReason('');
      setActionMessage({ 
        type: 'success', 
        text: `🚨 Signalement transmis immédiatement et directement à tous les formateurs et administrateurs de la plateforme !` 
      });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors du signalement.' });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Unread count in Inbox
  const unreadCount = inboxMessages.filter(m => !m.is_read).length;

  // Active folder items
  const getCurrentList = () => {
    switch (activeFolder) {
      case 'all': {
        const combined = [...inboxMessages, ...sentMessages];
        return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      case 'unread': return inboxMessages.filter(m => !m.is_read);
      case 'sent': return sentMessages;
      case 'drafts': return draftMessages;
      case 'trash': return trashMessages;
      default: return inboxMessages;
    }
  };

  const currentList = getCurrentList();
  const filteredList = currentList.filter(msg => {
    if (filterUnreadOnly && activeFolder === 'inbox' && msg.is_read) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const isReceived = activeFolder === 'inbox' || activeFolder === 'unread';
    const otherUser = isReceived ? msg.sender?.email : msg.recipient?.email;
    return (
      msg.subject.toLowerCase().includes(q) ||
      msg.body.toLowerCase().includes(q) ||
      (otherUser && otherUser.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-24 max-w-7xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shadow-lg shadow-primary/20 border border-primary/30">
              <Mail size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Messages & Communications</h1>
              <p className="text-text-secondary text-xs sm:text-sm">
                Gérez vos messages reçus, envoyés, brouillons, corbeille et échangez des pièces jointes en direct.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setIsComposing(true);
            setSelectedMessage(null);
            setSubject('');
            setBody('');
            setRecipientId('');
            setRecipientSearchText('');
            setAttachedFile(null);
            setExistingAttachment(null);
          }}
          className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/25 w-fit"
        >
          <Plus size={18} /> Nouveau message
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
        }`}>
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-text-primary">✕</button>
        </div>
      )}

      {/* Main Mailbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
        
        {/* Left Column : Folders (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-card p-3 rounded-2xl border border-border space-y-1.5">
            
            {/* Messages reçus */}
            <button
              onClick={() => {
                setActiveFolder('inbox');
                setFilterUnreadOnly(false);
                setIsComposing(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'inbox' && !isComposing
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <InboxIcon size={17} />
                <span>Messages reçus</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeFolder === 'inbox' && !isComposing ? 'bg-white/20 text-white' : 'text-text-secondary'
              }`}>
                {inboxMessages.length}
              </span>
            </button>

            {/* Messages non lus */}
            <button
              onClick={() => {
                setActiveFolder('unread');
                setIsComposing(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'unread' && !isComposing
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <Mail size={17} className={unreadCount > 0 && activeFolder !== 'unread' ? 'text-cyan-400' : ''} />
                <span>Messages non lus</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                unreadCount > 0
                  ? activeFolder === 'unread'
                    ? 'bg-slate-950 text-cyan-400'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : activeFolder === 'unread'
                  ? 'text-slate-950'
                  : 'text-text-secondary'
              }`}>
                {unreadCount}
              </span>
            </button>

            {/* Tous les messages */}
            <button
              onClick={() => {
                setActiveFolder('all');
                setFilterUnreadOnly(false);
                setIsComposing(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'all' && !isComposing
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers size={17} />
                <span>Tous les messages</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeFolder === 'all' && !isComposing ? 'bg-white/20 text-white' : 'text-text-secondary'
              }`}>
                {inboxMessages.length + sentMessages.length}
              </span>
            </button>

            {/* Messages envoyés */}
            <button
              onClick={() => {
                setActiveFolder('sent');
                setIsComposing(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'sent' && !isComposing
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <Send size={17} />
                <span>Messages envoyés</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeFolder === 'sent' && !isComposing ? 'bg-white/20 text-white' : 'text-text-secondary'
              }`}>
                {sentMessages.length}
              </span>
            </button>

            {/* Brouillons */}
            <button
              onClick={() => {
                setActiveFolder('drafts');
                setIsComposing(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'drafts' && !isComposing
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileEdit size={17} />
                <span>Brouillons</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeFolder === 'drafts' && !isComposing ? 'bg-white/20 text-white' : 'text-text-secondary'
              }`}>
                {draftMessages.length}
              </span>
            </button>

            {/* Corbeille */}
            <button
              onClick={() => {
                setActiveFolder('trash');
                setIsComposing(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeFolder === 'trash' && !isComposing
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <Trash2 size={17} />
                <span>Corbeille</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeFolder === 'trash' && !isComposing ? 'bg-white/20 text-white' : 'text-text-secondary'
              }`}>
                {trashMessages.length}
              </span>
            </button>

            {/* Ligne séparatrice */}
            <div className="h-px bg-border my-1.5" />

            {/* Calendrier & Emploi du temps */}
            <Link
              href="/calendar"
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all text-text-secondary hover:bg-primary/10 hover:text-primary group"
            >
              <div className="flex items-center gap-3">
                <CalendarIcon size={17} className="text-primary group-hover:scale-110 transition-transform" />
                <span>Calendrier</span>
              </div>
              <ArrowRight size={14} className="text-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>

          {/* User Status Card */}
          {currentUser && (
            <div className="glass-card p-4 rounded-2xl border border-border space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">Votre Compte</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-white shadow-md">
                  {currentUser.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate text-text-primary">{currentUser.email}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary uppercase">
                    <Shield size={11} /> {currentUser.role}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center Column : Messages List (4 cols) */}
        <div className="lg:col-span-4 space-y-3 flex flex-col">
          {/* Search bar */}
          <div className="glass-card p-3 rounded-2xl border border-border space-y-2">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par objet, personne..."
                className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl text-xs outline-none focus:border-primary transition-all text-text-primary"
              />
            </div>

            {(activeFolder === 'inbox' || activeFolder === 'unread' || activeFolder === 'all') && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  onClick={() => {
                    setActiveFolder('all');
                    setFilterUnreadOnly(false);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${activeFolder === 'all' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  Tous ({inboxMessages.length + sentMessages.length})
                </button>
                <button
                  onClick={() => {
                    setActiveFolder('inbox');
                    setFilterUnreadOnly(false);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${activeFolder === 'inbox' && !filterUnreadOnly ? 'bg-primary/20 text-primary border border-primary/30' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  Reçus ({inboxMessages.length})
                </button>
                <button
                  onClick={() => {
                    setActiveFolder('unread');
                    setFilterUnreadOnly(true);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${activeFolder === 'unread' || filterUnreadOnly ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  Non lus ({unreadCount})
                </button>
              </div>
            )}
          </div>

          {/* List items container */}
          <div className="glass-card p-2 rounded-2xl border border-border flex-1 overflow-y-auto max-h-[600px] space-y-2">
            {filteredList.length === 0 ? (
              <div className="py-20 text-center text-text-secondary text-xs">
                <Mail size={32} className="mx-auto mb-2 opacity-30" />
                Aucun message dans ce dossier.
              </div>
            ) : (
              filteredList.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id && !isComposing;
                const isReceived = activeFolder === 'inbox' || activeFolder === 'unread';
                const contact = isReceived ? msg.sender : msg.recipient;
                const contactEmail = contact?.email || (isReceived ? 'Expéditeur inconnu' : (msg.recipient_id ? `Utilisateur #${msg.recipient_id}` : 'Non spécifié'));

                return (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border text-left relative ${
                      isSelected
                        ? 'bg-primary/15 border-primary/40 shadow-sm'
                        : 'bg-surface/40 hover:bg-surface border-border hover:border-border-hover'
                    }`}
                  >
                    {/* Unread indicator */}
                    {!msg.is_read && isReceived && (
                      <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    )}

                    {/* Reported badge */}
                    {msg.is_reported && (
                      <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30 flex items-center gap-1">
                        <Flag size={10} /> Signalé
                      </span>
                    )}

                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                        {contactEmail.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-xs truncate max-w-[170px] ${!msg.is_read && isReceived ? 'font-extrabold text-text-primary' : 'font-medium text-text-secondary'}`}>
                        {isReceived ? contactEmail : `À : ${contactEmail}`}
                      </span>
                    </div>

                    <h4 className={`text-xs truncate mb-1 ${!msg.is_read && isReceived ? 'font-extrabold text-text-primary' : 'font-semibold text-text-primary'}`}>
                      {msg.subject}
                    </h4>

                    <p className="text-[11px] text-text-secondary truncate line-clamp-1 mb-2">
                      {msg.body || '(Brouillon vide)'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-text-secondary pt-1 border-t border-border/50">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(msg.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.attachment_url && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                          <Paperclip size={10} /> Pièce jointe
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column : Detail View OR Compose View (5 cols) */}
        <div className="lg:col-span-5">
          {/* 1. COMPOSE & DRAFT VIEW */}
          {isComposing ? (
            <div className="glass-card p-6 rounded-2xl border border-primary/30 space-y-6 animate-fade-in-up">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
                  <Send size={18} /> Rédiger un message
                </h2>
                <button
                  onClick={() => setIsComposing(false)}
                  className="text-text-secondary hover:text-text-primary text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendMessage} className="space-y-4">
                {/* Destinataire */}
                <div className="relative">
                  <label className="block text-xs uppercase font-bold text-text-secondary mb-1.5 flex items-center justify-between">
                    <span>Destinataire *</span>
                    {!canUseBroadcast && (
                      <span className="text-[10px] text-amber-400 font-normal lowercase">
                        (Envoi général "Tous" restreint pour votre rôle)
                      </span>
                    )}
                  </label>
                  {allUsers.length > 0 || canUseBroadcast ? (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="-- Sélectionnez ou tapez un destinataire --"
                        value={recipientSearchText}
                        onChange={(e) => {
                          setRecipientSearchText(e.target.value);
                          setIsRecipientDropdownOpen(true);
                          setRecipientId('');
                        }}
                        onFocus={() => setIsRecipientDropdownOpen(true)}
                        onBlur={() => {
                           setTimeout(() => setIsRecipientDropdownOpen(false), 200);
                        }}
                        className="w-full px-4 py-2.5 pr-10 rounded-xl bg-surface border border-border focus:border-primary text-xs outline-none"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                        <ChevronDown size={16} />
                      </div>
                      {isRecipientDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {/* Option Envoi Général (Broadcast) si rôle autorisé */}
                          {canUseBroadcast && (
                            <div
                              onClick={() => {
                                setRecipientId('-1');
                                setRecipientSearchText('📢 Tous les utilisateurs (Envoi Général - Broadcast)');
                                setIsRecipientDropdownOpen(false);
                              }}
                              className="px-4 py-2.5 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-400 border-b border-border flex items-center gap-2 transition-colors"
                            >
                              <span>📢 Tous les utilisateurs (Envoi Général - Broadcast)</span>
                            </div>
                          )}
                          {allUsers
                            .filter(u => u.id !== currentUser?.id)
                            .filter(u => {
                               const search = recipientSearchText.toLowerCase();
                               return u.email.toLowerCase().includes(search) || u.role.toLowerCase().includes(search);
                            })
                            .map(u => (
                              <div
                                key={u.id}
                                onClick={() => {
                                  setRecipientId(u.id.toString());
                                  setRecipientSearchText(`${u.email} (${u.role.toUpperCase()})`);
                                  setIsRecipientDropdownOpen(false);
                                }}
                                className="px-4 py-2.5 cursor-pointer hover:bg-primary/10 text-xs text-text-primary border-b border-border/50 last:border-0 transition-colors"
                              >
                                {u.email} <span className="text-text-secondary font-medium">({u.role.toUpperCase()})</span>
                              </div>
                            ))}
                            {allUsers.filter(u => u.id !== currentUser?.id && (u.email.toLowerCase().includes(recipientSearchText.toLowerCase()) || u.role.toLowerCase().includes(recipientSearchText.toLowerCase()))).length === 0 && !canUseBroadcast && (
                              <div className="px-4 py-3 text-xs text-text-secondary text-center">Aucun destinataire trouvé</div>
                            )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="number"
                      placeholder="ID du destinataire (ex: 1 pour administrateur)"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs outline-none"
                    />
                  )}
                </div>

                {/* Copie (CC) */}
                <div>
                  <label className="block text-xs uppercase font-bold text-text-secondary mb-1.5">
                    Copie (CC) — Adresses email / destinataires secondaires (séparés par des virgules)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: direction@eschola.pro, formateur@eschola.pro"
                    value={ccEmailsInput}
                    onChange={(e) => setCcEmailsInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs outline-none"
                  />
                </div>

                {/* Objet */}
                <div>
                  <label className="block text-xs uppercase font-bold text-text-secondary mb-1.5">
                    Objet du message *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Sujet de votre message..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs outline-none"
                  />
                </div>

                {/* Corps */}
                <div>
                  <label className="block text-xs uppercase font-bold text-text-secondary mb-1.5">
                    Message *
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Rédigez votre message ici..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-primary text-xs outline-none leading-relaxed resize-none"
                  />
                </div>

                {/* Pièce jointe */}
                <div>
                  <label className="block text-xs uppercase font-bold text-text-secondary mb-1.5">
                    Pièce jointe (PDF, Word, Excel, Images, Audio, Vidéo)
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setAttachedFile(e.target.files[0]);
                        setExistingAttachment(null);
                      }
                    }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,audio/*,video/*,image/*"
                    className="hidden"
                  />

                  {attachedFile ? (
                    <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[85%]">
                        <Paperclip size={16} className="text-primary shrink-0" />
                        <span className="font-semibold text-text-primary truncate">{attachedFile.name}</span>
                        <span className="text-[10px] text-text-secondary">({(attachedFile.size / 1024).toFixed(0)} Ko)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-text-secondary hover:text-red-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : existingAttachment ? (
                    <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[85%]">
                        <Paperclip size={16} className="text-primary shrink-0" />
                        <span className="font-semibold text-text-primary truncate">{existingAttachment.name}</span>
                        <span className="text-[10px] text-text-secondary">(Fichier existant)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExistingAttachment(null)}
                        className="text-text-secondary hover:text-red-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-border hover:border-primary/50 rounded-xl text-xs text-text-secondary hover:text-primary flex items-center justify-center gap-2 transition-colors"
                    >
                      <Paperclip size={16} />
                      Cliquez pour ajouter une pièce jointe
                    </button>
                  )}
                </div>

                {/* Actions : Envoyer, Enregistrer Brouillon, Annuler */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft || isSending}
                    className="w-full sm:w-auto px-4 py-3 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold border border-border flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isSavingDraft ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Enregistrer brouillon
                  </button>

                  <button
                    type="submit"
                    disabled={isSending}
                    className="w-full sm:flex-1 btn-primary py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
                  >
                    {isSending ? (
                      <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
                    ) : (
                      <><Send size={16} /> Envoyer</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsComposing(false)}
                    className="w-full sm:w-auto px-4 py-3 text-text-secondary hover:text-text-primary rounded-xl text-xs transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          ) : selectedMessage ? (
            /* 2. MESSAGE DETAIL VIEW */
            <div className="glass-card p-6 rounded-2xl border border-border space-y-6 animate-fade-in-up">
              
              {/* Header Actions */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={14} /> Retour
                </button>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Bouton Répondre */}
                  {(activeFolder === 'inbox' || activeFolder === 'unread') && (
                    <button
                      onClick={() => handleReply(selectedMessage)}
                      className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-colors"
                      title="Répondre à ce message"
                    >
                      <Reply size={14} className="text-primary" /> Répondre
                    </button>
                  )}

                  {/* Bouton Transférer */}
                  <button
                    onClick={() => handleForward(selectedMessage)}
                    className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-colors"
                    title="Transférer ce message à un autre utilisateur"
                  >
                    <Forward size={14} className="text-cyan-400" /> Transférer
                  </button>

                  {/* Bouton Restaurer (si dans la corbeille) */}
                  {activeFolder === 'trash' ? (
                    <button
                      onClick={() => handleRestoreMessage(selectedMessage.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 flex items-center gap-1.5 transition-colors"
                      title="Restaurer ce message"
                    >
                      <RotateCcw size={14} /> Restaurer
                    </button>
                  ) : (
                    /* Bouton Signaler le message */
                    (activeFolder === 'inbox' || activeFolder === 'unread') && (
                      <button
                        onClick={() => setReportingMessage(selectedMessage)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-400 flex items-center gap-1.5 transition-colors"
                        title="Signaler ce message au formateur et à l'administrateur"
                      >
                        <Flag size={14} /> Signaler
                      </button>
                    )
                  )}

                  {/* Bouton Supprimer */}
                  <button
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                    className="p-1.5 rounded-lg bg-surface hover:bg-rose-500/10 border border-border hover:border-rose-500/30 text-text-secondary hover:text-rose-400 transition-colors"
                    title={activeFolder === 'trash' ? "Supprimer définitivement" : "Déplacer vers la corbeille"}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Reported Alert Banner if already reported */}
              {selectedMessage.is_reported && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 font-medium">
                  <AlertTriangle size={18} className="shrink-0" />
                  <div>
                    <span className="font-bold">Message signalé aux formateurs et administrateurs</span>
                    {selectedMessage.report_reason && (
                      <p className="text-[11px] text-rose-300/80 mt-0.5">Motif : {selectedMessage.report_reason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Subject Title */}
              <div>
                <h2 className="text-xl font-bold text-text-primary leading-snug">
                  {selectedMessage.subject}
                </h2>
                <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                  <Clock size={12} />
                  <span>
                    {new Date(selectedMessage.created_at).toLocaleString([], { 
                      dateStyle: 'full', 
                      timeStyle: 'short' 
                    })}
                  </span>
                </div>
              </div>

              {/* Badges Spéciaux (Broadcast, Welcome, CC, Relais) */}
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedMessage.is_broadcast && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 text-xs flex items-center gap-1.5">
                    📢 Envoi Général (Broadcast)
                  </span>
                )}
                {selectedMessage.is_welcome_msg && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 text-xs flex items-center gap-1.5">
                    🎉 Message d'accueil automatique
                  </span>
                )}
                {(selectedMessage.cc_emails || selectedMessage.subject.includes('[Copie]')) && (
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 text-xs flex items-center gap-1.5">
                    👥 Copie (CC) {selectedMessage.cc_emails ? `: ${selectedMessage.cc_emails}` : ''}
                  </span>
                )}
                {selectedMessage.is_relay && (
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30 text-xs flex items-center gap-1.5">
                    🔄 Mode Relais
                  </span>
                )}
              </div>

              {/* Sender & Recipient Box */}
              <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                    {(selectedMessage.sender?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary">
                      De : {selectedMessage.sender?.email || 'Utilisateur'}
                    </p>
                    <p className="text-[11px] text-text-secondary">
                      À : {selectedMessage.recipient?.email || (selectedMessage.is_broadcast ? 'Tous les utilisateurs' : 'Vous')}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  {selectedMessage.sender?.role || 'Utilisateur'}
                </span>
              </div>

              {/* Message Body Content */}
              <div className="p-4 rounded-xl bg-surface/30 border border-border text-sm leading-relaxed whitespace-pre-wrap text-text-primary min-h-[140px]">
                {selectedMessage.body}
              </div>

              {/* Classroom Invite Action Button */}
              {selectedMessage.subject.includes('Invitation à une classe virtuelle') && (
                <div className="pt-4 border-t border-border mt-4">
                  <button
                    onClick={() => {
                      const match = selectedMessage.body.match(/Code de la salle\s*:\s*`?([a-zA-Z0-9-]+)`?/);
                      const code = match ? match[1] : '';
                      if (code) {
                        router.push(`/classroom/${code}`);
                      } else {
                        router.push('/classroom');
                      }
                    }}
                    className="w-full sm:w-auto btn-primary px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
                  >
                    <Video size={18} /> Rejoindre la classe virtuelle
                  </button>
                </div>
              )}

              {/* Attachment Section */}
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
                    className="flex items-center justify-between p-4 bg-surface hover:bg-surface-hover rounded-xl border border-border transition-colors group/att"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {selectedMessage.attachment_type === 'image' ? (
                        <ImageIcon size={24} className="text-purple-400 shrink-0" />
                      ) : selectedMessage.attachment_type === 'audio' ? (
                        <Music size={24} className="text-cyan-400 shrink-0" />
                      ) : selectedMessage.attachment_type === 'video' ? (
                        <Film size={24} className="text-yellow-400 shrink-0" />
                      ) : selectedMessage.attachment_name?.includes('xls') ? (
                        <FileSpreadsheet size={24} className="text-emerald-400 shrink-0" />
                      ) : (
                        <FileText size={24} className="text-primary shrink-0" />
                      )}

                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {selectedMessage.attachment_name || 'Fichier joint'}
                        </p>
                        <p className="text-[11px] text-text-secondary uppercase font-mono">
                          {selectedMessage.attachment_type || 'Fichier'}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold group-hover/att:bg-primary group-hover/att:text-white transition-colors">
                      <Download size={14} /> Télécharger
                    </span>
                  </a>

                  {selectedMessage.attachment_type === 'image' && (
                    <div className="rounded-xl overflow-hidden border border-border mt-3 max-h-60">
                      <img 
                        src={selectedMessage.attachment_url} 
                        alt="Pièce jointe" 
                        className="w-full h-auto object-cover" 
                      />
                    </div>
                  )}

                  {selectedMessage.attachment_type === 'audio' && (
                    <audio controls src={selectedMessage.attachment_url} className="w-full mt-3" />
                  )}

                  {selectedMessage.attachment_type === 'video' && (
                    <video controls src={selectedMessage.attachment_url} className="w-full max-h-60 rounded-xl mt-3" />
                  )}
                </div>
              )}
            </div>
          ) : (
            /* 3. EMPTY STATE */
            <div className="glass-card p-12 rounded-2xl border border-border flex flex-col items-center justify-center text-center text-text-secondary h-full min-h-[400px] space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center text-primary/40 shadow-inner">
                <Mail size={36} />
              </div>
              <h3 className="text-base font-bold text-text-primary">Sélectionnez un message</h3>
              <p className="text-xs max-w-xs">
                Choisissez un message dans la liste à gauche pour le consulter, le transférer ou y répondre.
              </p>
              <button
                onClick={() => {
                  setIsComposing(true);
                  setSelectedMessage(null);
                }}
                className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 mt-2"
              >
                <Plus size={16} /> Écrire un message
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL : SIGNALER LE MESSAGE AU FORMATEUR ET ADMINISTRATEUR                 */}
      {/* ========================================================================= */}
      {reportingMessage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-rose-500/30 space-y-5 animate-fade-in-up">
            
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <Flag size={20} />
                <h3>Signaler ce message</h3>
              </div>
              <button 
                onClick={() => setReportingMessage(null)}
                className="text-text-secondary hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} /> Transmission directe d'alerte :
              </p>
              <p>
                Ce signalement avec le contenu intégral du message sera transmis **automatiquement et immédiatement** à tous les formateurs et administrateurs de la plateforme.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-text-secondary">
                Message : <span className="font-semibold text-text-primary">« {reportingMessage.subject} »</span>
              </p>
              <p className="text-text-secondary">
                Expéditeur : <span className="font-semibold text-text-primary">{reportingMessage.sender?.email}</span>
              </p>
            </div>

            {/* Motif du signalement */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-text-secondary">
                Motif du signalement :
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-xs outline-none focus:border-rose-500"
              >
                <option value="Contenu inapproprié ou offensant">Contenu inapproprié ou offensant</option>
                <option value="Harcèlement ou propos haineux">Harcèlement ou propos haineux</option>
                <option value="Spam ou tentative d'hameçonnage">Spam ou tentative d'hameçonnage</option>
                <option value="Partage de fichier suspect ou dangereux">Partage de fichier suspect ou dangereux</option>
                <option value="Autre motif">Autre motif</option>
              </select>

              {reportReason === 'Autre motif' && (
                <textarea
                  rows={3}
                  value={customReportReason}
                  onChange={(e) => setCustomReportReason(e.target.value)}
                  placeholder="Précisez la raison de votre signalement..."
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs outline-none focus:border-rose-500 mt-2"
                />
              )}
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReportingMessage(null)}
                className="w-1/2 py-2.5 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold border border-border"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                {isSubmittingReport ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />}
                Transmettre l'alerte
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
