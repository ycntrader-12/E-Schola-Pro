'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { 
  UserPlus, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Lock, 
  Unlock, 
  Calendar, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  User as UserIcon, 
  Phone, 
  Mail, 
  CreditCard 
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { 
  COUNTRIES_AND_CITIES, 
  SPECIALIZATIONS, 
  DEPARTMENTS, 
  calculateAge, 
  generateUsername 
} from '@/lib/profileData';

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations('Auth');
  const tRoles = useTranslations('Roles');
  const tCommon = useTranslations('Common');

  // Core Form State
  const [role, setRole] = useState<'étudiant' | 'stagiaire' | 'employer'>('étudiant');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [username, setUsername] = useState('');
  const [isManualUsername, setIsManualUsername] = useState(false);
  const [dateNaissance, setDateNaissance] = useState('');
  
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [cin, setCin] = useState('');
  const [adresse, setAdresse] = useState('');
  
  const [pays, setPays] = useState('Maroc');
  const [ville, setVille] = useState('Casablanca');
  
  const [departement, setDepartement] = useState(DEPARTMENTS[0]);
  const [specialisation, setSpecialisation] = useState(SPECIALIZATIONS[0]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Available cities based on selected country
  const availableCities = useMemo(() => {
    return COUNTRIES_AND_CITIES[pays] || ['Autre ville'];
  }, [pays]);

  // Dynamic live age calculation
  const calculatedAge = useMemo(() => {
    return calculateAge(dateNaissance);
  }, [dateNaissance]);

  // Auto-sync username when nom or prenom changes (if not locked to manual)
  const handleNomChange = (val: string) => {
    setNom(val);
    if (!isManualUsername) {
      setUsername(generateUsername(val, prenom));
    }
  };

  const handlePrenomChange = (val: string) => {
    setPrenom(val);
    if (!isManualUsername) {
      setUsername(generateUsername(nom, val));
    }
  };

  const handleCountryChange = (selectedCountry: string) => {
    setPays(selectedCountry);
    const cities = COUNTRIES_AND_CITIES[selectedCountry] || ['Autre ville'];
    setVille(cities[0] || '');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!nom.trim() || !prenom.trim()) {
      setError('Le nom et le prénom sont obligatoires.');
      return;
    }

    const finalUsername = (username.trim() || generateUsername(nom, prenom)).toLowerCase();
    if (!finalUsername) {
      setError("Le nom d'utilisateur est obligatoire.");
      return;
    }

    if (!dateNaissance) {
      setError('La date de naissance est obligatoire.');
      return;
    }

    if (calculatedAge !== null && calculatedAge < 14) {
      setError("L'âge minimum requis pour s'inscrire est de 14 ans.");
      return;
    }

    if (!pays || !ville) {
      setError('Le pays et la ville sont obligatoires.');
      return;
    }

    if ((role === 'employer' || role === 'stagiaire') && !departement) {
      setError('Veuillez sélectionner un département professionnel.');
      return;
    }

    if ((role === 'étudiant' || role === 'stagiaire') && !specialisation) {
      setError('Veuillez sélectionner une spécialisation académique.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create User via Public API
      await apiClient.post('/users/', {
        username: finalUsername,
        nom: nom.trim(),
        prenom: prenom.trim(),
        date_naissance: dateNaissance,
        email: email.trim() ? email.trim() : undefined,
        telephone: telephone.trim() || undefined,
        cin: cin.trim() || undefined,
        adresse: adresse.trim() || undefined,
        pays,
        ville,
        departement: (role === 'employer' || role === 'stagiaire') ? departement : undefined,
        specialisation: (role === 'étudiant' || role === 'stagiaire') ? specialisation : undefined,
        password,
        role,
      });

      // 2. Automatically log them in (Universal login accepts username or email)
      const loginResponse = await apiClient.post('/login/access-token', {
        username: finalUsername,
        password: password,
      });
      
      localStorage.setItem('access_token', loginResponse.data.access_token);
      document.cookie = `access_token=${loginResponse.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
      
      try {
        const parts = loginResponse.data.access_token.split('.');
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(decodeURIComponent(escape(atob(base64))));
        if (payload.role) {
          localStorage.setItem('user_role', String(payload.role).trim().toLowerCase());
        }
      } catch {}

      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || tCommon('error') || "Une erreur est survenue lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  // Maximum selectable date is today
  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen relative flex items-center justify-center pt-24 pb-16 px-4 select-none bg-slate-50/60">
      
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <BackButton />
      </div>

      {/* Registration Container (Wide, structured and accessible) */}
      <div className="relative z-10 w-full max-w-2xl p-6 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6 my-auto transition-all">
        
        {/* Header with Badge */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877f2] text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
            <UserPlus size={13} className="text-[#1877f2]" />
            <span>E-Schola Pro Inscription</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {t('register_title')}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
            {t('register_subtitle')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs text-center font-semibold animate-shake">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-6 text-xs">
          
          {/* SECTION 1: Choix du Rôle */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {t('role')} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'étudiant', label: tRoles('etudiant'), icon: GraduationCap },
                { val: 'stagiaire', label: tRoles('stagiaire'), icon: Briefcase },
                { val: 'employer', label: tRoles('employer'), icon: UserIcon },
              ].map(({ val, label, icon: Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setRole(val as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    role === val
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30 font-bold scale-[1.02]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 font-medium'
                  }`}
                >
                  <Icon size={18} className="mb-1" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 2: État Civil & Identité */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <UserIcon size={14} />
              <span>1. Identité & État Civil</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('nom')} *
                </label>
                <input 
                  type="text" 
                  value={nom}
                  onChange={(e) => handleNomChange(e.target.value)}
                  required
                  placeholder="Ex: Alami"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('prenom')} *
                </label>
                <input 
                  type="text" 
                  value={prenom}
                  onChange={(e) => handlePrenomChange(e.target.value)}
                  required
                  placeholder="Ex: Karim"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                />
              </div>
            </div>

            {/* Username with toggle auto/manual */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  {t('username') || "Nom d'utilisateur"} *
                </label>
                <button
                  type="button"
                  onClick={() => setIsManualUsername(!isManualUsername)}
                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  {isManualUsername ? (
                    <>
                      <Lock size={11} /> <span>Mode auto</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={11} /> <span>{t('custom_username') || 'Personnaliser'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => {
                    setIsManualUsername(true);
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                  }}
                  required
                  placeholder="karim.alami"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs font-mono"
                />
                {!isManualUsername && username && (
                  <span className="absolute right-3 top-2.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-200">
                    Auto-généré
                  </span>
                )}
              </div>
            </div>

            {/* Date de naissance + Live Age Badge */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{t('date_naissance')} *</span>
                </label>
                {calculatedAge !== null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold animate-fade-in">
                    🎂 {calculatedAge} {t('years_old') || 'ans'}
                  </span>
                )}
              </div>
              <input 
                type="date" 
                max={todayIso}
                value={dateNaissance}
                onChange={(e) => setDateNaissance(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all shadow-xs cursor-pointer"
              />
            </div>
          </div>

          {/* SECTION 3: Localisation & Coordonnées */}
          <div className="space-y-3 pt-2">
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <MapPin size={14} />
              <span>2. Localisation & Coordonnées</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pays */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('pays') || 'Pays'} *
                </label>
                <select
                  value={pays}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all cursor-pointer shadow-xs font-medium"
                >
                  {Object.keys(COUNTRIES_AND_CITIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ville */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('ville') || 'Ville'} *
                </label>
                <select
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all cursor-pointer shadow-xs font-medium"
                >
                  {availableCities.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email (Optionnel) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('email')} <span className="text-slate-400 font-normal">({t('cin') ? 'Optionnel' : 'Optionnel'})</span>
                </label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@exemple.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                />
              </div>

              {/* Téléphone (Optionnel) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('telephone') || 'Téléphone'} <span className="text-slate-400 font-normal">(Optionnel)</span>
                </label>
                <input 
                  type="tel" 
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="+212 6 12 34 56 78"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CIN (Optionnel) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('cin') || 'CIN'} <span className="text-slate-400 font-normal">(Optionnel)</span>
                </label>
                <input 
                  type="text" 
                  value={cin}
                  onChange={(e) => setCin(e.target.value.toUpperCase())}
                  placeholder="BK123456"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs font-mono"
                />
              </div>

              {/* Adresse (Optionnel) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('adresse') || 'Adresse'} <span className="text-slate-400 font-normal">(Optionnel)</span>
                </label>
                <input 
                  type="text" 
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  placeholder="Quartier, Rue, N°..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Informations Conditionnelles selon le Rôle */}
          <div className="space-y-3 pt-2">
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <Briefcase size={14} />
              <span>3. Affectation Pédagogique & Professionnelle</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Spécialisation (Visible pour Étudiant & Stagiaire) */}
              {(role === 'étudiant' || role === 'stagiaire') && (
                <div className="animate-fade-in">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t('specialisation') || 'Spécialisation / Filière'} *
                  </label>
                  <select
                    value={specialisation}
                    onChange={(e) => setSpecialisation(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-blue-200 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all cursor-pointer shadow-xs font-medium"
                  >
                    {SPECIALIZATIONS.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Département (Visible pour Employé & Stagiaire) */}
              {(role === 'employer' || role === 'stagiaire') && (
                <div className="animate-fade-in">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t('departement') || 'Département'} *
                  </label>
                  <select
                    value={departement}
                    onChange={(e) => setDepartement(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-blue-200 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all cursor-pointer shadow-xs font-medium"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 5: Sécurité & Mot de Passe */}
          <div className="space-y-3 pt-2">
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <Lock size={14} />
              <span>4. Sécurité du Compte</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('password')} *
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-[#1877f2] transition-colors cursor-pointer"
                    title={showPassword ? t('hide_password') : t('show_password')}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('confirm_password')} *
                </label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-[#1877f2] transition-colors cursor-pointer"
                    title={showConfirmPassword ? t('hide_password') : t('show_password')}
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-sm shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus size={16} />
                <span>{t('submit_register')}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-slate-500 text-xs">
            {t('already_account')}{' '}
            <Link 
              href="/login" 
              className="text-[#1877f2] font-bold hover:underline inline-flex items-center gap-0.5"
            >
              {t('sign_in_link')}
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
