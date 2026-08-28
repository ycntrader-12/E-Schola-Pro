'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Link as LinkIcon, Download, ExternalLink, Loader2, File } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Deliverable {
  id: number;
  event_id: int;
  user_id: number;
  file_url: string | null;
  link_url: string | null;
  submitted_at: string;
  user?: { id: number; email: string; role: string };
}

interface DeliverablesModalProps {
  event: any;
  currentUser: { id: number; email: string; role: string } | null;
  onClose: () => void;
}

export default function DeliverablesModal({ event, currentUser, onClose }: DeliverablesModalProps) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = currentUser?.role === 'formateur' || currentUser?.role === 'admin';

  const fetchDeliverables = async () => {
    try {
      const res = await apiClient.get(`/events/${event.id}/deliverables`);
      setDeliverables(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliverables();
  }, [event.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await apiClient.post(`/events/${event.id}/deliverables`, {
        file_url,
        link_url: linkUrl || null
      });

      // Reset form & refresh
      setLinkUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDeliverables();
      
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card max-w-2xl w-full p-6 rounded-3xl border border-primary/30 space-y-6 animate-fade-in-up max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-primary font-bold text-lg">Livrables : {event.title}</h3>
            <p className="text-xs text-text-secondary mt-1">Gérez les rendus et soumissions pour ce cours / événement</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-white p-2">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
          {/* Submission Form (for Students) */}
          {!canManage && (
            <div className="bg-surface/50 p-4 rounded-xl border border-border">
              <h4 className="text-sm font-bold mb-3">Soumettre votre travail</h4>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Joindre un fichier (Tout format)</label>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Ou ajouter un lien (Google Drive, GitHub, etc.)</label>
                  <input 
                    type="url" 
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full btn-primary py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  Envoyer le livrable
                </button>
              </form>
            </div>
          )}

          {/* List of Deliverables */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <File size={16} className="text-primary" />
              {canManage ? "Tous les rendus des étudiants" : "Vos soumissions"}
            </h4>

            {isLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>
            ) : deliverables.length === 0 ? (
              <p className="text-xs text-text-secondary italic text-center p-4">Aucun livrable soumis pour le moment.</p>
            ) : (
              <div className="grid gap-3">
                {deliverables.map(del => (
                  <div key={del.id} className="bg-background p-3 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      {canManage && del.user && (
                        <p className="text-xs font-bold text-white truncate">{del.user.email}</p>
                      )}
                      <p className="text-[10px] text-text-secondary">Soumis le {new Date(del.submitted_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {del.file_url && (
                        <a 
                          href={del.file_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Download size={14} /> Fichier
                        </a>
                      )}
                      {del.link_url && (
                        <a 
                          href={del.link_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-surface hover:bg-border text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-border"
                        >
                          <ExternalLink size={14} /> Lien
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
