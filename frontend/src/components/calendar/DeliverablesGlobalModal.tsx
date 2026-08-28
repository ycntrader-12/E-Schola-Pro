'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Link as LinkIcon, Download, ExternalLink, Loader2, File, Calendar as CalendarIcon } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Event {
  id: number;
  title: string;
  start_time: string;
}

interface DeliverablesGlobalModalProps {
  currentUser: { id: number; email: string; role: string } | null;
  onClose: () => void;
}

export default function DeliverablesGlobalModal({ currentUser, onClose }: DeliverablesGlobalModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await apiClient.get('/events');
        // Sort by start_time descending to show recent/upcoming first
        const sortedEvents = res.data.sort((a: any, b: any) => 
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        );
        setEvents(sortedEvents);
      } catch (err) {
        console.error("Failed to fetch events", err);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEventId) {
      alert('Veuillez sélectionner un cours / événement.');
      return;
    }
    
    if (!linkUrl && (!fileInputRef.current?.files || fileInputRef.current.files.length === 0)) {
      alert('Veuillez fournir un lien ou sélectionner un fichier.');
      return;
    }

    setIsSubmitting(true);
    try {
      let file_url = null;
      
      // Upload file if selected
      if (fileInputRef.current?.files && fileInputRef.current.files.length > 0) {
        const file = fileInputRef.current.files[0];
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadRes = await apiClient.post('/upload/file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        file_url = uploadRes.data.url;
      }

      // Submit deliverable
      await apiClient.post(`/events/${selectedEventId}/deliverables`, {
        file_url,
        link_url: linkUrl || null
      });

      alert('Livrable soumis avec succès !');
      onClose();
      
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full p-6 rounded-3xl border border-primary/30 space-y-6 animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-base">
            <Upload size={20} />
            <h3>Soumettre un livrable</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-white p-2">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Select Event */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">
              Pour quel cours / événement ? *
            </label>
            {isLoadingEvents ? (
              <div className="flex items-center gap-2 text-xs text-text-secondary p-2">
                <Loader2 size={14} className="animate-spin" /> Chargement des cours...
              </div>
            ) : (
              <select 
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(Number(e.target.value))}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none"
                required
              >
                <option value="" disabled>-- Sélectionner un événement --</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({new Date(ev.start_time).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">
              Fichier (Tous formats acceptés)
            </label>
            <input 
              type="file" 
              ref={fileInputRef}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
            />
          </div>

          {/* Link URL */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">
              Ou Lien (Google Drive, GitHub, etc.)
            </label>
            <div className="relative">
              <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="url" 
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border/50">
            <button 
              type="submit" 
              disabled={isSubmitting || isLoadingEvents}
              className="w-full btn-primary py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin" size={16} /> Envoi en cours...</>
              ) : (
                <><Upload size={16} /> Soumettre mon travail</>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
