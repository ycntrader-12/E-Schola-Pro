'use client';

import { useState } from 'react';
import { 
  Bell, 
  Shield, 
  BookOpen, 
  Settings2, 
  Eye, 
  Server, 
  Mail, 
  GraduationCap
} from 'lucide-react';

interface RoleSettingsProps {
  role: string;
}

export default function RoleSettings({ role }: RoleSettingsProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    emailNotifs: true,
    messageAlerts: true,
    publicProfile: false,
    autoPublishGrades: true,
    twoFactorAuth: false,
    maintenanceMode: false,
    strictPasswords: true,
    weeklyReports: true,
    showEmailToStudents: false,
    courseRecommendations: true,
  });

  const [saving, setSaving] = useState<string | null>(null);

  const togglePref = (key: string) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaving(key);
    setTimeout(() => setSaving(null), 600);
  };

  const Switch = ({ id, label, description, checked, onChange, isSaving }: any) => (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-200 hover:bg-slate-100 transition-colors group">
      <div className="space-y-1 pr-4">
        <label htmlFor={id} className="text-sm font-bold text-slate-900 cursor-pointer select-none">
          {label}
        </label>
        <p className="text-xs text-slate-500 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={isSaving}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          checked ? 'bg-[#1877f2]' : 'bg-slate-300'
        }`}
      >
        <span className="sr-only">Toggle {label}</span>
        <span
          className={`pointer-events-none absolute left-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );

  const Section = ({ icon: Icon, title, description, children }: any) => (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1877f2] flex items-center justify-center shrink-0">
          <Icon size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );

  const renderLearnerSettings = () => (
    <div className="space-y-8 animate-fade-in-up">
      <Section 
        icon={Bell} 
        title="Notifications et Alertes" 
        description="Gérez comment et quand vous souhaitez être contacté."
      >
        <Switch
          id="emailNotifs"
          label="Rappels de Cours"
          description="Recevez un email 1h avant le début de votre classe virtuelle."
          checked={prefs.emailNotifs}
          onChange={() => togglePref('emailNotifs')}
          isSaving={saving === 'emailNotifs'}
        />
        <Switch
          id="messageAlerts"
          label="Messages Privés"
          description="Soyez notifié instantanément lors d'un nouveau message."
          checked={prefs.messageAlerts}
          onChange={() => togglePref('messageAlerts')}
          isSaving={saving === 'messageAlerts'}
        />
      </Section>

      <Section 
        icon={BookOpen} 
        title="Préférences d'Apprentissage" 
        description="Adaptez la plateforme à votre rythme et vos objectifs."
      >
        <Switch
          id="courseRecommendations"
          label="Recommandations Intelligentes"
          description="Autoriser l'IA à suggérer des cours basés sur vos résultats."
          checked={prefs.courseRecommendations}
          onChange={() => togglePref('courseRecommendations')}
          isSaving={saving === 'courseRecommendations'}
        />
      </Section>

      <Section 
        icon={Eye} 
        title="Confidentialité" 
        description="Contrôlez la visibilité de vos informations."
      >
        <Switch
          id="publicProfile"
          label="Profil Public dans le Groupe"
          description="Les autres apprenants de votre groupe peuvent voir votre adresse email."
          checked={prefs.publicProfile}
          onChange={() => togglePref('publicProfile')}
          isSaving={saving === 'publicProfile'}
        />
      </Section>
    </div>
  );

  const renderTrainerSettings = () => (
    <div className="space-y-8 animate-fade-in-up">
      <Section 
        icon={GraduationCap} 
        title="Préférences Pédagogiques" 
        description="Configurez votre espace de formation et d'évaluation."
      >
        <Switch
          id="autoPublishGrades"
          label="Publication Auto des Notes"
          description="Afficher la note immédiatement après la soumission d'un Quiz."
          checked={prefs.autoPublishGrades}
          onChange={() => togglePref('autoPublishGrades')}
          isSaving={saving === 'autoPublishGrades'}
        />
      </Section>

      <Section 
        icon={Bell} 
        title="Notifications de Classe" 
        description="Restez informé de l'activité de vos apprenants."
      >
        <Switch
          id="emailNotifs"
          label="Soumissions de Quiz"
          description="Recevoir une notification à chaque fin de test."
          checked={prefs.emailNotifs}
          onChange={() => togglePref('emailNotifs')}
          isSaving={saving === 'emailNotifs'}
        />
        <Switch
          id="messageAlerts"
          label="Questions des Étudiants"
          description="Alertes en direct lors des sessions d'apprentissage."
          checked={prefs.messageAlerts}
          onChange={() => togglePref('messageAlerts')}
          isSaving={saving === 'messageAlerts'}
        />
      </Section>

      <Section 
        icon={Eye} 
        title="Visibilité & Contact" 
        description="Gérez votre disponibilité auprès des groupes."
      >
        <Switch
          id="showEmailToStudents"
          label="Afficher mon Email personnel"
          description="Les étudiants verront votre adresse email complète sur vos cours."
          checked={prefs.showEmailToStudents}
          onChange={() => togglePref('showEmailToStudents')}
          isSaving={saving === 'showEmailToStudents'}
        />
      </Section>
    </div>
  );

  const renderAdminSettings = () => (
    <div className="space-y-8 animate-fade-in-up">
      <Section 
        icon={Shield} 
        title="Sécurité Globale" 
        description="Paramètres critiques de protection de la plateforme."
      >
        <Switch
          id="twoFactorAuth"
          label="Forcer la Double Authentification"
          description="Obliger les administrateurs et formateurs à utiliser le 2FA."
          checked={prefs.twoFactorAuth}
          onChange={() => togglePref('twoFactorAuth')}
          isSaving={saving === 'twoFactorAuth'}
        />
        <Switch
          id="strictPasswords"
          label="Mots de Passe Stricts"
          description="Exiger 12 caractères, majuscules et caractères spéciaux."
          checked={prefs.strictPasswords}
          onChange={() => togglePref('strictPasswords')}
          isSaving={saving === 'strictPasswords'}
        />
      </Section>

      <Section 
        icon={Server} 
        title="Système & Maintenance" 
        description="Contrôle de l'accès général à E-Schola Pro."
      >
        <Switch
          id="maintenanceMode"
          label="Mode Maintenance"
          description="Bloquer l'accès aux étudiants (seuls les admins peuvent se connecter)."
          checked={prefs.maintenanceMode}
          onChange={() => togglePref('maintenanceMode')}
          isSaving={saving === 'maintenanceMode'}
        />
      </Section>

      <Section 
        icon={Mail} 
        title="Suivi & Reporting" 
        description="Rapports d'activité de l'infrastructure."
      >
        <Switch
          id="weeklyReports"
          label="Rapport Hebdomadaire"
          description="Recevoir un récapitulatif des inscriptions et des statistiques."
          checked={prefs.weeklyReports}
          onChange={() => togglePref('weeklyReports')}
          isSaving={saving === 'weeklyReports'}
        />
      </Section>
    </div>
  );

  return (
    <div className="pt-6 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-6">
        <Settings2 size={24} className="text-[#1877f2]" />
        <h2 className="text-xl font-bold text-slate-900">
          Préférences &amp; Configuration
        </h2>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm">
        {['étudiant', 'stagiaire', 'employer'].includes(role) && renderLearnerSettings()}
        {['formateur', 'pedagogique'].includes(role) && renderTrainerSettings()}
        {['admin', 'admin_manager', 'admin_limited'].includes(role) && renderAdminSettings()}
      </div>
    </div>
  );
}
