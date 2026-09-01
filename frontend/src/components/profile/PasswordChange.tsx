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
    <div className="pt-6 border-t border-slate-200 mt-8">
      <div className="flex items-center gap-2 mb-6">
        <Key size={24} className="text-[#1877f2]" />
        <h2 className="text-xl font-bold text-slate-900">
          Sécurité &amp; Mot de passe
        </h2>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          
          {message && (
            <div className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
              message.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1.5 block">
              Mot de passe actuel
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-900 text-xs sm:text-sm"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1.5 block">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-900 text-xs sm:text-sm"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1.5 block">
              Confirmer le nouveau mot de passe
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-900 text-xs sm:text-sm"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1877f2] text-white font-bold text-xs sm:text-sm rounded-xl hover:bg-[#166fe5] shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Mise à jour...</>
              ) : (
                <><Key size={16} /> Mettre à jour le mot de passe</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
