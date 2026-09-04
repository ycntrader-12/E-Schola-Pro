'use client';

import React, { useState, useRef } from 'react';
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
  Pencil,
  Camera,
  Shield,
  Loader2,
  CheckCircle2,
  Award,
  Sparkles,
  Users,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { UserProfileData, ProfileEditForm } from './ProfileEditForm';
import { calculateAge } from '@/lib/profileData';

export interface UserProfileCardProps {
  user: UserProfileData;
  onProfileUpdated?: (updatedUser: UserProfileData) => void;
  isEditable?: boolean;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user: initialUser,
  onProfileUpdated,
  isEditable = true,
}) => {
  const [user, setUser] = useState<UserProfileData>(initialUser);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state if prop changes
  React.useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const age = calculateAge(user.date_naissance || '');

  const getRoleBadgeStyle = (role: string) => {
    const lower = (role || '').toLowerCase();
    if (lower.includes('admin')) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    if (lower.includes('formateur') || lower.includes('prof')) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (lower.includes('pedagog')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    if (lower.includes('stagiaire')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (lower.includes('employer') || lower.includes('employe')) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadMessage({ type: 'error', text: 'Le fichier doit être une image (JPG, PNG, WebP).' });
      return;
    }

    setIsUploadingAvatar(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updated = res.data;
      setUser(updated);
      if (onProfileUpdated) onProfileUpdated(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth_user_updated'));
        window.dispatchEvent(new Event('storage'));
      }
      setUploadMessage({ type: 'success', text: 'Photo de profil mise à jour avec succès.' });
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setUploadMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Échec de la mise à jour de la photo de profil.',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleFormSuccess = (updatedUser: UserProfileData) => {
    setUser(updatedUser);
    setIsEditing(false);
    if (onProfileUpdated) onProfileUpdated(updatedUser);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth_user_updated'));
      window.dispatchEvent(new Event('storage'));
    }
    setUploadMessage({ type: 'success', text: 'Profil mis à jour avec succès.' });
  };

  const fullName = [user.prenom, user.nom].filter(Boolean).join(' ').trim()
    ? [user.prenom, user.nom].filter(Boolean).join(' ')
    : user.username || user.email;

  if (isEditing) {
    return (
      <div className="glass-card p-6 rounded-2xl border border-primary/30 space-y-4 animate-fade-in-up">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Pencil size={18} className="text-primary" />
            Modification du profil utilisateur
          </h2>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-xs text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-xl bg-surface border border-border"
          >
            Annuler
          </button>
        </div>

        <ProfileEditForm
          user={user}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {uploadMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
            uploadMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {uploadMessage.text}
          </span>
          <button
            type="button"
            onClick={() => setUploadMessage(null)}
            className="text-text-secondary hover:text-text-primary"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile Header Banner */}
      <div className="glass-card p-6 rounded-3xl border border-border relative overflow-hidden">
        {/* Ambient Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-500/5 to-cyan-500/10 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          {/* Avatar & User Core Details */}
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* Avatar Container with Upload trigger */}
            <div className="relative group">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarFileChange}
                accept="image/*"
                className="hidden"
              />

              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-primary/40 bg-surface flex items-center justify-center shadow-xl relative group-hover:border-primary transition-all">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-extrabold text-primary">
                    {(fullName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}

                {/* Camera Hover Overlay */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 cursor-pointer"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 size={20} className="animate-spin text-primary" />
                    ) : (
                      <>
                        <Camera size={20} />
                        <span>Changer</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Verified Shield Badge */}
              <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-white shadow-md">
                <Shield size={14} />
              </div>
            </div>

            {/* User Title Details */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight">
                  {fullName}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${getRoleBadgeStyle(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>

              <p className="text-xs font-mono text-text-secondary flex items-center justify-center sm:justify-start gap-1.5">
                <Sparkles size={12} className="text-primary" />
                @{user.username || 'utilisateur'}
                <span className="text-[10px] text-text-secondary/60">
                  (ID: #{user.id})
                </span>
              </p>

              {/* Quick Info Chips */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-primary" />
                  {user.email}
                </span>

                {(user.ville || user.pays) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-cyan-400" />
                    {[user.ville, user.pays].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Button: Edit Profile */}
          {isEditable && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/25 hover:scale-105 transition-transform"
            >
              <Pencil size={15} />
              Modifier mon profil
            </button>
          )}
        </div>
      </div>

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Informations Personnelles */}
        <div className="glass-card p-6 rounded-2xl border border-border space-y-4 hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 pb-2 border-b border-border text-primary font-bold text-xs uppercase tracking-wider">
            <UserIcon size={16} />
            Informations Personnelles
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Prénom</span>
              <p className="font-bold text-text-primary mt-0.5">{user.prenom || 'Non renseigné'}</p>
            </div>

            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Nom de famille</span>
              <p className="font-bold text-text-primary mt-0.5">{user.nom || 'Non renseigné'}</p>
            </div>

            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Nom d'utilisateur</span>
              <p className="font-mono text-primary mt-0.5 font-bold">@{user.username || 'non_renseigné'}</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-text-secondary block text-[11px] font-semibold">Date de naissance</span>
                <p className="font-bold text-text-primary mt-0.5">{user.date_naissance || 'Non renseignée'}</p>
              </div>
              {age !== null && (
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                  🎂 {age} ans
                </span>
              )}
            </div>

            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">CIN / Pièce d'identité</span>
              <p className="font-bold text-text-primary mt-0.5">{user.cin || 'Non renseigné'}</p>
            </div>
          </div>
        </div>

        {/* Card 2: Coordonnées & Localisation */}
        <div className="glass-card p-6 rounded-2xl border border-border space-y-4 hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center gap-2 pb-2 border-b border-border text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <Globe size={16} />
            Coordonnées & Localisation
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Email officiel</span>
              <p className="font-bold text-text-primary mt-0.5 truncate">{user.email}</p>
            </div>

            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Téléphone</span>
              <p className="font-bold text-text-primary mt-0.5">{user.telephone || 'Non renseigné'}</p>
            </div>

            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Pays de résidence</span>
              <p className="font-bold text-text-primary mt-0.5">{user.pays || 'Non renseigné'}</p>
            </div>

            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Ville</span>
              <p className="font-bold text-text-primary mt-0.5">{user.ville || 'Non renseignée'}</p>
            </div>

            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Adresse postale</span>
              <p className="font-bold text-text-primary mt-0.5">{user.adresse || 'Non renseignée'}</p>
            </div>
          </div>
        </div>

        {/* Card 3: Profil Académique / Institutionnel */}
        <div className="glass-card p-6 rounded-2xl border border-border space-y-4 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center gap-2 pb-2 border-b border-border text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Briefcase size={16} />
            Institution & Spécifications
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Rôle attribué</span>
              <span
                className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${getRoleBadgeStyle(
                  user.role
                )}`}
              >
                {user.role}
              </span>
            </div>

            {user.departement && (
              <div>
                <span className="text-text-secondary block text-[11px] font-semibold">Département</span>
                <p className="font-bold text-text-primary mt-0.5">{user.departement}</p>
              </div>
            )}

            {user.specialisation && (
              <div>
                <span className="text-text-secondary block text-[11px] font-semibold">Spécialisation</span>
                <p className="font-bold text-text-primary mt-0.5">{user.specialisation}</p>
              </div>
            )}

            <div>
              <span className="text-text-secondary block text-[11px] font-semibold">Statut du compte</span>
              <p className="font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Actif & Vérifié
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
