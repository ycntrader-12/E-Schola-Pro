'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Globe,
  Briefcase,
  GraduationCap,
  Calendar,
  CreditCard,
  Save,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import {
  COUNTRIES_AND_CITIES,
  SPECIALIZATIONS,
  DEPARTMENTS,
  calculateAge,
  generateUsername,
} from '@/lib/profileData';

export interface UserProfileData {
  id: number;
  email: string;
  role: string;
  avatar_url?: string;
  username?: string;
  nom?: string;
  prenom?: string;
  departement?: string;
  specialisation?: string;
  date_naissance?: string;
  cin?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
}

export interface ProfileEditFormValues {
  nom: string;
  prenom: string;
  username: string;
  email: string;
  telephone: string;
  cin: string;
  date_naissance: string;
  pays: string;
  ville: string;
  departement: string;
  specialisation: string;
  adresse: string;
  password?: string;
}

export interface ProfileEditFormProps {
  user: UserProfileData;
  onSuccess: (updatedUser: UserProfileData) => void;
  onCancel: () => void;
  isAdminMode?: boolean;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  user,
  onSuccess,
  onCancel,
  isAdminMode = false,
}) => {
  const [isManualUsername, setIsManualUsername] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileEditFormValues>({
    defaultValues: {
      nom: user.nom || '',
      prenom: user.prenom || '',
      username: user.username || '',
      email: user.email || '',
      telephone: user.telephone || '',
      cin: user.cin || '',
      date_naissance: user.date_naissance || '',
      pays: user.pays || 'Tunisie',
      ville: user.ville || 'Tunis',
      departement: user.departement || '',
      specialisation: user.specialisation || '',
      adresse: user.adresse || '',
      password: '',
    },
  });

  const watchNom = watch('nom');
  const watchPrenom = watch('prenom');
  const watchDateNaissance = watch('date_naissance');
  const watchPays = watch('pays');

  // Auto-generate username when nom or prenom changes (unless manual edit is enabled)
  useEffect(() => {
    if (!isManualUsername && (watchNom || watchPrenom)) {
      const generated = generateUsername(watchNom || '', watchPrenom || '');
      setValue('username', generated);
    }
  }, [watchNom, watchPrenom, isManualUsername, setValue]);

  // Available cities based on selected country
  const availableCities = useMemo(() => {
    const selectedCountry = watchPays || 'Tunisie';
    return COUNTRIES_AND_CITIES[selectedCountry] || ['Autre ville'];
  }, [watchPays]);

  // Live age calculation
  const calculatedAge = useMemo(() => {
    return calculateAge(watchDateNaissance);
  }, [watchDateNaissance]);

  const userRoleLower = (user.role || '').toLowerCase();
  const isEmployeeOrStagiaire = userRoleLower.includes('employer') || userRoleLower.includes('employe') || userRoleLower.includes('stagiaire');
  const isStudentOrStagiaire = userRoleLower.includes('étudiant') || userRoleLower.includes('etudiant') || userRoleLower.includes('stagiaire');

  const onSubmit = async (values: ProfileEditFormValues) => {
    setErrorMessage(null);

    // Validate minimum age if birth date is supplied
    if (calculatedAge !== null && calculatedAge < 14) {
      setErrorMessage('L\'utilisateur doit être âgé d\'au moins 14 ans.');
      return;
    }

    try {
      const endpoint = isAdminMode ? `/users/${user.id}` : '/users/me';
      const payload = {
        username: values.username.trim() || undefined,
        email: values.email.trim() || undefined,
        nom: values.nom.trim() || undefined,
        prenom: values.prenom.trim() || undefined,
        telephone: values.telephone.trim() || undefined,
        cin: values.cin.trim() || undefined,
        date_naissance: values.date_naissance || undefined,
        adresse: values.adresse.trim() || undefined,
        ville: values.ville || undefined,
        pays: values.pays || undefined,
        departement: isEmployeeOrStagiaire ? values.departement : undefined,
        specialisation: isStudentOrStagiaire ? values.specialisation : undefined,
        password: values.password && values.password.trim() ? values.password.trim() : undefined,
      };

      const response = await apiClient.put(endpoint, payload);
      onSuccess(response.data);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setErrorMessage(
        err?.response?.data?.detail || 'Une erreur est survenue lors de la mise à jour du profil.'
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-fade-in-up">
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-xs font-semibold text-rose-400">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section 1: Informations Personnelles */}
      <div className="glass-card p-6 rounded-2xl border border-border space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border">
          <UserIcon size={16} className="text-primary" />
          Informations Personnelles
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Prénom */}
          <div>
            <label className="block font-bold text-text-secondary mb-1">Prénom *</label>
            <input
              type="text"
              placeholder="Votre prénom..."
              {...register('prenom', { required: 'Le prénom est obligatoire' })}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            />
            {errors.prenom && (
              <p className="text-[11px] text-rose-400 mt-1">{errors.prenom.message}</p>
            )}
          </div>

          {/* Nom */}
          <div>
            <label className="block font-bold text-text-secondary mb-1">Nom *</label>
            <input
              type="text"
              placeholder="Votre nom de famille..."
              {...register('nom', { required: 'Le nom est obligatoire' })}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            />
            {errors.nom && (
              <p className="text-[11px] text-rose-400 mt-1">{errors.nom.message}</p>
            )}
          </div>

          {/* Nom d'utilisateur (Username Slug) */}
          <div className="sm:col-span-2 space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-text-secondary">Nom d'utilisateur (Slug) *</label>
              <button
                type="button"
                onClick={() => setIsManualUsername(!isManualUsername)}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <Sparkles size={12} />
                {isManualUsername ? 'Auto-générer' : 'Personnaliser manuellement'}
              </button>
            </div>
            <input
              type="text"
              readOnly={!isManualUsername}
              placeholder="ex: prenom.nom"
              {...register('username', { required: 'Le nom d\'utilisateur est obligatoire' })}
              className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-none transition-colors ${
                !isManualUsername
                  ? 'bg-surface/50 border-border/60 text-text-secondary font-mono cursor-not-allowed'
                  : 'bg-surface border-primary text-text-primary font-mono'
              }`}
            />
            {!isManualUsername && (
              <p className="text-[10px] text-text-secondary italic">
                Généré automatiquement à partir de votre prénom et nom.
              </p>
            )}
          </div>

          {/* Date de Naissance & Âge calculé */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-text-secondary">Date de naissance</label>
              {calculatedAge !== null && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                  🎂 {calculatedAge} ans
                </span>
              )}
            </div>
            <input
              type="date"
              {...register('date_naissance')}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            />
          </div>

          {/* CIN */}
          <div>
            <label className="block font-bold text-text-secondary mb-1">Numéro CIN / Identité</label>
            <input
              type="text"
              placeholder="ex: 08123456"
              {...register('cin')}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Coordonnées & Localisation */}
      <div className="glass-card p-6 rounded-2xl border border-border space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border">
          <Globe size={16} className="text-cyan-400" />
          Coordonnées & Localisation
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Email */}
          <div>
            <label className="block font-bold text-text-secondary mb-1">Adresse Email *</label>
            <input
              type="email"
              placeholder="nom@eschola.pro"
              {...register('email', { required: 'L\'email est obligatoire' })}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            />
            {errors.email && (
              <p className="text-[11px] text-rose-400 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Téléphone */}
          <div>
            <label className="block font-bold text-text-secondary mb-1">Téléphone</label>
            <input
              type="tel"
              placeholder="+216 20 123 456"
              {...register('telephone')}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            />
          </div>

          {/* Pays (Cascading Dropdown) */}
          <div>
            <label className="block font-bold text-text-secondary mb-1">Pays</label>
            <select
              {...register('pays')}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            >
              {Object.keys(COUNTRIES_AND_CITIES).map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          {/* Ville */}
          <div>
            <label className="block font-bold text-text-secondary mb-1">Ville</label>
            <select
              {...register('ville')}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            >
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Adresse complète */}
          <div className="sm:col-span-2">
            <label className="block font-bold text-text-secondary mb-1">Adresse postale</label>
            <input
              type="text"
              placeholder="Rue, avenue, quartier, code postal..."
              {...register('adresse')}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Profil Professionnel / Académique (Selon Rôle) */}
      {(isEmployeeOrStagiaire || isStudentOrStagiaire) && (
        <div className="glass-card p-6 rounded-2xl border border-border space-y-4">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border">
            <Briefcase size={16} className="text-amber-400" />
            Spécifications de Rôle ({user.role})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Département (Employé / Stagiaire) */}
            {isEmployeeOrStagiaire && (
              <div>
                <label className="block font-bold text-text-secondary mb-1">
                  Département professionnel *
                </label>
                <select
                  {...register('departement')}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
                >
                  <option value="">-- Sélectionner un département --</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Spécialisation (Étudiant / Stagiaire) */}
            {isStudentOrStagiaire && (
              <div>
                <label className="block font-bold text-text-secondary mb-1">
                  Spécialisation académique *
                </label>
                <select
                  {...register('specialisation')}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
                >
                  <option value="">-- Sélectionner une spécialisation --</option>
                  {SPECIALIZATIONS.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 4: Mot de passe (Optionnel) */}
      <div className="glass-card p-6 rounded-2xl border border-border space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-border">
          <Lock size={16} className="text-rose-400" />
          Sécurité & Mot de Passe (Optionnel)
        </h3>

        <div className="text-xs">
          <label className="block font-bold text-text-secondary mb-1">Nouveau mot de passe</label>
          <input
            type="password"
            placeholder="Laissez vide pour conserver le mot de passe actuel"
            {...register('password')}
            className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:border-primary text-xs text-text-primary outline-none transition-colors"
          />
        </div>
      </div>

      {/* Actions: Save / Cancel */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-1/2 py-3 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold border border-border text-text-primary transition-colors"
        >
          Annuler
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-1/2 btn-primary py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Enregistrement...
            </>
          ) : (
            <>
              <Save size={16} /> Enregistrer les modifications
            </>
          )}
        </button>
      </div>
    </form>
  );
};
