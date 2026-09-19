'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api';
import { Mail, CheckCircle2, AlertCircle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await apiClient.post('/password-reset/forgot-password', {
        email: email.trim(),
      });
      setSubmitted(true);
      setMessage(
        response.data?.message ||
          "Si l'adresse saisie correspond à un compte actif, un lien de réinitialisation vous a été envoyé par email."
      );
    } catch (err: any) {
      const detailMsg = err?.response?.data?.detail;
      if (err?.response?.status === 429) {
        setError("Trop de tentatives effectuées. Veuillez patienter quelques minutes avant de réessayer.");
      } else if (err?.message === 'Network Error' || !err?.response) {
        setError("Impossible de contacter le serveur backend. Veuillez vérifier votre connexion.");
      } else {
        setError(detailMsg || "Une erreur est survenue lors de l'envoi de la demande. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center pt-24 pb-12 px-4 select-none bg-white">
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <BackButton />
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-5 my-auto transition-all">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Link href="/" className="inline-block group" title="Accueil E-Schola Pro">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md shadow-blue-500/10 group-hover:scale-105 transition-transform">
                <Image
                  src="/images/logo_icon_transparent.png"
                  alt="E-Schola Pro"
                  width={56}
                  height={56}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
            </Link>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877f2] text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
            <ShieldCheck size={13} className="text-[#1877f2]" />
            <span>Récupération Sécurisée</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Mot de passe oublié ?
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
            Saisissez votre adresse email ci-dessous. Nous vous enverrons un lien de réinitialisation sécurisé.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-fade-in">
            <AlertCircle size={17} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Success View */}
        {submitted ? (
          <div className="space-y-5 py-2 animate-fade-in">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-950 text-sm">Demande transmise avec succès</p>
                  <p className="leading-relaxed text-emerald-800 text-[11px]">{message}</p>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">💡 Conseil d'utilisation :</p>
              <p>Le lien expire automatiquement dans <strong>60 minutes</strong>. Si vous n'avez rien reçu dans 2 minutes, pensez à vérifier vos dossiers Spam / Courriers indésirables.</p>
            </div>

            <div className="pt-2 space-y-2">
              <Link
                href="/login"
                className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <ArrowLeft size={15} />
                <span>Retour à la page de connexion</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setMessage('');
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Renvoyer une autre demande
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {t('email')}
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                  placeholder="votre.email@exemple.com"
                />
                <Mail size={16} className="absolute inset-y-0 left-3 my-auto text-slate-400 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 mt-2 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50 transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound size={15} />
              <span>{loading ? tCommon('loading') : 'Envoyer le lien de réinitialisation'}</span>
            </button>
          </form>
        )}

        {/* Back link */}
        {!submitted && (
          <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-100">
            <Link href="/login" className="text-[#1877f2] font-bold hover:underline inline-flex items-center gap-1.5">
              <ArrowLeft size={14} />
              <span>Retour à la connexion</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
