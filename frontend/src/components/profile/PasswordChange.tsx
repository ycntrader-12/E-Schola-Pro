'use client';

import { useState } from 'react';
import { Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function PasswordChange() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.put('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setMessage({ type: 'success', text: 'Mot de passe mis à jour avec succès.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || 'Erreur lors de la mise à jour du mot de passe.';
      setMessage({ type: 'error', text: errorDetail });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-6 border-t border-border mt-8">
      <div className="flex items-center gap-2 mb-8">
        <Key size={24} className="text-text-primary" />
        <h2 className="text-2xl font-black text-text-primary">
          Sécurité & Mot de passe
        </h2>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl bg-surface/30 border border-border backdrop-blur-sm max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
              message.type === 'success' 
                ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{message.text}</span>
            </div>
          )}

          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1.5 block">
              Mot de passe actuel
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1.5 block">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1.5 block">
              Confirmer le nouveau mot de passe
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Mise à jour...</>
              ) : (
                <><Key size={18} /> Mettre à jour le mot de passe</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
