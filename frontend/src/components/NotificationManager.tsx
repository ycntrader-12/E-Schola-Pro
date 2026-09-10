'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { apiClient } from '@/lib/api';
import { playNotificationSound } from '@/lib/sound';
import { MessageSquare, Video, X, ExternalLink, Bell } from 'lucide-react';

interface ToastNotification {
  id: string;
  type: 'message' | 'invitation';
  title: string;
  body: string;
  actionUrl: string;
  actionText: string;
}

export default function NotificationManager() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const prevUnreadRef = useRef<number | null>(null);
  const prevPendingInvitesRef = useRef<number | null>(null);
  const isInitialFetchRef = useRef(true);

  // Request browser notification permission once user interacts
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      window.removeEventListener('click', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, []);

  const showToast = (toast: Omit<ToastNotification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto-remove toast after 7 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 7000);

    // Also trigger native desktop notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(toast.title, {
          body: toast.body,
          icon: '/images/logo_icon_transparent.png',
        });
      } catch {
        // Ignore desktop notification error
      }
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const checkNotifications = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        prevUnreadRef.current = null;
        prevPendingInvitesRef.current = null;
        isInitialFetchRef.current = true;
        return;
      }

      try {
        const [unreadRes, invitesRes, roomsRes] = await Promise.all([
          apiClient.get('/messages/unread-count').catch(() => ({ data: { unread_count: 0 } })),
          apiClient.get('/classrooms/invitations/my-invitations').catch(() => ({ data: [] })),
          apiClient.get('/classrooms/').catch(() => ({ data: [] })),
        ]);

        const currentUnread = unreadRes.data?.unread_count || 0;
        const currentInvites = Array.isArray(invitesRes.data)
          ? invitesRes.data.filter((i: any) => i.status === 'pending').length
          : 0;

        // Skip sound/toast on initial load, only record baseline
        if (isInitialFetchRef.current) {
          prevUnreadRef.current = currentUnread;
          prevPendingInvitesRef.current = currentInvites;
          isInitialFetchRef.current = false;
          return;
        }

        // 1. Detect New Messages
        if (prevUnreadRef.current !== null && currentUnread > prevUnreadRef.current) {
          const delta = currentUnread - prevUnreadRef.current;
          playNotificationSound('message');
          showToast({
            type: 'message',
            title: delta === 1 ? 'Nouveau message reçu 💬' : `${delta} nouveaux messages reçus 💬`,
            body: 'Vous avez reçu un nouveau message dans votre boîte de réception.',
            actionUrl: '/inbox',
            actionText: 'Consulter la boîte',
          });
          window.dispatchEvent(new CustomEvent('messages_updated', { detail: { unread_count: currentUnread } }));
        }

        // 2. Detect New Classroom / Video Conference Invitations
        if (prevPendingInvitesRef.current !== null && currentInvites > prevPendingInvitesRef.current) {
          const delta = currentInvites - prevPendingInvitesRef.current;
          playNotificationSound('invitation');
          showToast({
            type: 'invitation',
            title: delta === 1 ? 'Nouvelle invitation : Salle vidéo conférence 🎥' : `${delta} nouvelles invitations : Salles vidéo conférence 🎥`,
            body: 'Un formateur vous a invité à rejoindre une session en direct.',
            actionUrl: '/classroom',
            actionText: 'Rejoindre la salle',
          });
          window.dispatchEvent(new CustomEvent('classroom_updated', { detail: { pending_invites: currentInvites } }));
        }

        prevUnreadRef.current = currentUnread;
        prevPendingInvitesRef.current = currentInvites;
      } catch {
        // Silently catch background polling errors
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 8000);

    const onMessagesUpdated = () => {
      checkNotifications();
    };
    const onClassroomUpdated = () => {
      checkNotifications();
    };

    window.addEventListener('messages_updated', onMessagesUpdated);
    window.addEventListener('classroom_updated', onClassroomUpdated);
    window.addEventListener('storage', checkNotifications);

    return () => {
      clearInterval(interval);
      window.removeEventListener('messages_updated', onMessagesUpdated);
      window.removeEventListener('classroom_updated', onClassroomUpdated);
      window.removeEventListener('storage', checkNotifications);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-4 fade-in ${
            toast.type === 'invitation'
              ? 'bg-slate-900/95 border-emerald-500/40 text-white shadow-emerald-500/10'
              : 'bg-slate-900/95 border-blue-500/40 text-white shadow-blue-500/10'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                toast.type === 'invitation'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              {toast.type === 'invitation' ? (
                <Video size={20} className="animate-pulse" />
              ) : (
                <MessageSquare size={20} className="animate-bounce" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-bold text-white truncate">{toast.title}</h4>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Fermer"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{toast.body}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    removeToast(toast.id);
                    router.push(toast.actionUrl);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                    toast.type === 'invitation'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-[#1877f2] hover:bg-blue-600 text-white'
                  }`}
                >
                  <span>{toast.actionText}</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
