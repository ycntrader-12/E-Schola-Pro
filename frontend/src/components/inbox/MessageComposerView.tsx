'use client';

import React, { useState, useRef, memo, useEffect } from 'react';
import { useForm, Controller, Control } from 'react-hook-form';
import {
  Send,
  Save,
  Paperclip,
  X,
  Loader2,
  UserPlus,
  Mail,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Edit3,
  Clock,
} from 'lucide-react';
import { RecipientInput } from './RecipientInput';
import { UserMinimalRead, ComposerFormValues } from '@/types/recipient';
import { apiClient } from '@/lib/api';

export interface SavedMessageSummary {
  to: UserMinimalRead[];
  cc?: UserMinimalRead[];
  subject: string;
  body: string;
  attachmentName?: string;
  isDraft: boolean;
  savedAt: string;
}

export interface MessageComposerViewProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialToRecipients?: UserMinimalRead[];
  initialSubject?: string;
  initialBody?: string;
}

interface CcSectionProps {
  control: Control<ComposerFormValues>;
  toRecipients: UserMinimalRead[];
  disabled?: boolean;
}

const CollapsibleCcSection: React.FC<CcSectionProps> = memo(
  ({ control, toRecipients, disabled }) => {
    const [isCcVisible, setIsCcVisible] = useState(false);

    return (
      <div className="space-y-1.5 transition-all">
        {!isCcVisible ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsCcVisible(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-colors py-1"
          >
            <UserPlus size={14} />
            + Ajouter des destinataires en copie (CC)
          </button>
        ) : (
          <div className="space-y-1.5 bg-background/60 p-3 rounded-xl border border-border animate-fade-in-up">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] uppercase font-bold text-text-secondary tracking-wider">
                Copie conforme (CC)
              </span>
              <button
                type="button"
                onClick={() => setIsCcVisible(false)}
                className="text-[11px] font-medium text-text-secondary hover:text-rose-400 transition-colors"
              >
                Masquer CC
              </button>
            </div>

            <Controller
              name="cc"
              control={control}
              render={({ field }: { field: { value: UserMinimalRead[]; onChange: (val: UserMinimalRead[]) => void } }) => (
                <RecipientInput
                  placeholder="Rechercher des destinataires secondaires en CC..."
                  selectedRecipients={field.value || []}
                  onChange={field.onChange}
                  alreadySelectedUsers={[...toRecipients, ...(field.value || [])]}
                  disabled={disabled}
                />
              )}
            />
          </div>
        )}
      </div>
    );
  }
);

CollapsibleCcSection.displayName = 'CollapsibleCcSection';

const EMPTY_RECIPIENTS: UserMinimalRead[] = [];

export const MessageComposerView: React.FC<MessageComposerViewProps> = ({
  onClose,
  onSuccess,
  initialToRecipients = EMPTY_RECIPIENTS,
  initialSubject = '',
  initialBody = '',
}) => {
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [savedSummary, setSavedSummary] = useState<SavedMessageSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ComposerFormValues>({
    defaultValues: {
      to: initialToRecipients,
      cc: [],
      subject: initialSubject,
      body: initialBody,
    },
  });

  useEffect(() => {
    reset({
      to: initialToRecipients || EMPTY_RECIPIENTS,
      cc: [],
      subject: initialSubject || '',
      body: initialBody || '',
    });
    setAttachedFile(null);
    setSavedSummary(null);
    clearErrors();
  }, [initialToRecipients, initialSubject, initialBody, reset, clearErrors]);

  const watchTo = watch('to') || [];
  const watchCc = watch('cc') || [];

  const uploadAttachment = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/upload/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return {
        url: res.data.file_url || res.data.url,
        name: file.name,
        type: res.data.file_type || (file.type.startsWith('image/') ? 'image' : 'document'),
      };
    } catch (err) {
      console.error('File upload error:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFormSubmit = async (values: ComposerFormValues, isDraft = false) => {
    if (!isDraft && (!values.to || values.to.length === 0)) {
      setError('to', {
        type: 'manual',
        message: 'Veuillez sélectionner au moins un destinataire principal (À).',
      });
      return;
    }
    clearErrors('to');

    let fileData = null;
    if (attachedFile) {
      fileData = await uploadAttachment(attachedFile);
    }

    try {
      const ccIds = (values.cc || []).map((u) => Number(u.id)).filter(Boolean);
      const ccEmails = (values.cc || []).map((u) => u.email).filter(Boolean);

      const recipientIds = (values.to || []).map((u) => Number(u.id)).filter(Boolean);
      const recipientEmails = (values.to || []).map((u) => u.email).filter(Boolean);

      const payload = {
        recipient_id: recipientIds[0] || null,
        recipient_email: recipientEmails[0] || null,
        recipient_ids: recipientIds,
        recipient_emails: recipientEmails,
        cc_recipient_ids: ccIds,
        cc_emails: ccEmails,
        subject: values.subject ? values.subject.trim() : '',
        body: values.body ? values.body.trim() : '',
        attachment_url: fileData?.url || null,
        attachment_name: fileData?.name || null,
        attachment_type: fileData?.type || null,
        is_draft: isDraft,
      };

      await apiClient.post('/messages/', payload);

      // Switch to integrated post-save / post-submission summary card
      setSavedSummary({
        to: values.to || [],
        cc: values.cc || [],
        subject: values.subject ? values.subject.trim() : 'Sans objet',
        body: values.body,
        attachmentName: fileData?.name || attachedFile?.name,
        isDraft,
        savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error submitting message:', err);
      const detail = err?.response?.data?.detail;
      let displayMessage = 'Une erreur est survenue lors de l\'envoi du message.';
      if (typeof detail === 'string') {
        displayMessage = detail;
      } else if (Array.isArray(detail)) {
        displayMessage = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      } else if (detail?.message) {
        displayMessage = detail.message;
      }
      setError('root', {
        type: 'manual',
        message: displayMessage,
      });
    }
  };

  const onSaveDraft = () => {
    handleSubmit((values: ComposerFormValues) => handleFormSubmit(values, true))();
  };

  // VUE 1 : Fiche récapitulative post-sauvegarde / envoi (Rendu rectangulaire intégré)
  if (savedSummary) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
        <div className="w-full max-w-4xl mx-auto flex flex-col rounded-xl border border-border bg-surface shadow-sm overflow-hidden animate-fade-in">
          {/* Header Summary */}
          <div className="py-4 px-6 border-b border-border flex items-center justify-between bg-surface/80">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-background text-text-secondary hover:text-text-primary transition-colors"
                title="Retour à la liste"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex items-center gap-2">
                {savedSummary.isDraft ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                    <FileText size={14} /> Brouillon enregistré
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    <CheckCircle2 size={14} /> Message envoyé avec succès
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Clock size={13} />
              <span>Enregistré à {savedSummary.savedAt}</span>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-background text-text-secondary hover:text-text-primary transition-colors ml-2"
                title="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Details & Separators */}
          <div className="divide-y divide-border/60">
            {/* Destinataires (À) */}
            <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary w-28 shrink-0">
                Destinataires :
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {savedSummary.to.map((u) => (
                  <span
                    key={String(u.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium"
                  >
                    <span className="font-semibold">{u.full_name}</span>
                    <span className="text-[10px] text-text-secondary">({u.email})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* CC si présent */}
            {savedSummary.cc && savedSummary.cc.length > 0 && (
              <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary w-28 shrink-0">
                  En copie (CC) :
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {savedSummary.cc.map((u) => (
                    <span
                      key={String(u.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-medium text-text-secondary"
                    >
                      <span>{u.full_name}</span>
                      <span className="text-[10px]">({u.email})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Objet */}
            <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary w-28 shrink-0">
                Objet :
              </span>
              <h2 className="text-sm font-bold text-text-primary">{savedSummary.subject}</h2>
            </div>

            {/* Corps du message */}
            <div className="p-5 sm:p-6 bg-background/40">
              <div className="text-xs sm:text-sm text-text-primary leading-relaxed whitespace-pre-wrap font-normal">
                {savedSummary.body}
              </div>
            </div>

            {/* Pièce jointe si présente */}
            {savedSummary.attachmentName && (
              <div className="p-4 sm:px-6 flex items-center gap-2 text-xs text-text-secondary">
                <Paperclip size={14} className="text-primary" />
                <span className="font-medium">Fichier joint :</span>
                <span className="font-bold text-text-primary">{savedSummary.attachmentName}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="py-4 px-6 border-t border-border bg-surface flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold border border-border flex items-center gap-1.5 text-text-primary transition-colors"
            >
              <ArrowLeft size={14} /> Retour à la boîte de réception
            </button>

            <div className="flex items-center gap-2.5">
              {savedSummary.isDraft ? (
                <button
                  type="button"
                  onClick={() => setSavedSummary(null)}
                  className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Edit3 size={14} /> Reprendre la rédaction
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    reset({
                      to: [],
                      cc: [],
                      subject: '',
                      body: '',
                    });
                    setAttachedFile(null);
                    setSavedSummary(null);
                  }}
                  className="px-4 py-2 btn-primary rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/25"
                >
                  <Mail size={14} /> Écrire un nouveau message
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VUE 2 : Formulaire de rédaction rectangulaire in-app intégré
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
      <div className="w-full max-w-4xl mx-auto flex flex-col rounded-xl border border-border bg-surface shadow-sm overflow-hidden animate-fade-in-up">
        {/* Header Rectangulaire Intégré */}
        <div className="py-3 px-6 border-b border-border flex items-center justify-between bg-surface/80">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-background text-text-secondary hover:text-text-primary transition-colors"
              title="Retour aux messages"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
              <Mail size={18} className="text-primary" />
              <span>Nouveau Message</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background text-text-secondary hover:text-text-primary transition-colors"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Wrap */}
        <form
          onSubmit={handleSubmit((values: ComposerFormValues) => handleFormSubmit(values, false))}
          className="flex flex-col divide-y divide-border/60"
        >
          {errors.root && (
            <div className="m-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-semibold">
              {errors.root.message}
            </div>
          )}

          {/* Section Destinataires Principaux (À) & CC */}
          <div className="p-4 sm:px-6 space-y-3 bg-surface">
            <div className="relative z-30">
              <Controller
                name="to"
                control={control}
                rules={{
                  validate: (val: UserMinimalRead[]) =>
                    (val && val.length >= 1) || 'Veuillez sélectionner au moins un destinataire principal.',
                }}
                render={({ field }: { field: { value: UserMinimalRead[]; onChange: (val: UserMinimalRead[]) => void } }) => (
                  <RecipientInput
                    label="À (Destinataires principaux) *"
                    placeholder="Entrez le nom, prénom ou email du destinataire..."
                    selectedRecipients={field.value || []}
                    onChange={(recipients) => {
                      field.onChange(recipients);
                      if (recipients.length > 0) clearErrors('to');
                    }}
                    alreadySelectedUsers={[...(field.value || []), ...watchCc]}
                    error={errors.to?.message}
                    disabled={isSubmitting || isUploading}
                  />
                )}
              />
            </div>

            <div className="relative z-20">
              <CollapsibleCcSection
                control={control}
                toRecipients={watchTo}
                disabled={isSubmitting || isUploading}
              />
            </div>
          </div>

          {/* Section Objet du Message */}
          <div className="p-4 sm:px-6 bg-surface">
            <label className="block text-[11px] uppercase font-bold text-text-secondary mb-1.5 tracking-wider">
              Objet du message *
            </label>
            <input
              type="text"
              placeholder="Objet de votre message..."
              disabled={isSubmitting || isUploading}
              {...register('subject', { required: 'L\'objet est obligatoire' })}
              className={`w-full px-3.5 py-2.5 rounded-xl bg-background border text-xs outline-none transition-colors ${
                errors.subject
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.subject && (
              <p className="text-[11px] text-rose-500 font-medium mt-1">
                {errors.subject.message}
              </p>
            )}
          </div>

          {/* Section Corps du Message */}
          <div className="p-4 sm:px-6 bg-surface">
            <label className="block text-[11px] uppercase font-bold text-text-secondary mb-1.5 tracking-wider">
              Message *
            </label>
            <textarea
              rows={8}
              placeholder="Rédigez votre message ici..."
              disabled={isSubmitting || isUploading}
              {...register('body', { required: 'Le corps du message est obligatoire' })}
              className={`w-full px-4 py-3 rounded-xl bg-background border text-xs outline-none leading-relaxed resize-none transition-colors min-h-[180px] ${
                errors.body
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.body && (
              <p className="text-[11px] text-rose-500 font-medium mt-1">
                {errors.body.message}
              </p>
            )}
          </div>

          {/* Section Pièce Jointe */}
          <div className="p-4 sm:px-6 bg-surface">
            <label className="block text-[11px] uppercase font-bold text-text-secondary mb-1.5 tracking-wider">
              Pièce jointe (Optionnel)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setAttachedFile(e.target.files[0]);
                }
              }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,audio/*,video/*,image/*"
              className="hidden"
            />

            {attachedFile ? (
              <div className="py-2.5 px-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate max-w-[85%]">
                  <Paperclip size={15} className="text-primary shrink-0" />
                  <span className="font-semibold text-text-primary truncate">
                    {attachedFile.name}
                  </span>
                  <span className="text-[10px] text-text-secondary">
                    ({(attachedFile.size / 1024).toFixed(0)} Ko)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-text-secondary hover:text-rose-400 p-0.5 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || isUploading}
                className="w-full py-2.5 border border-dashed border-border hover:border-primary/50 rounded-xl text-xs text-text-secondary hover:text-primary flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Paperclip size={15} />
                Cliquez pour sélectionner un fichier joint
              </button>
            )}
          </div>

          {/* Footer Actions Rectangulaire Intégré */}
          <div className="py-4 px-6 border-t border-border bg-surface flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold hover:bg-background transition-colors"
            >
              Annuler
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={isSubmitting || isUploading}
                className="px-4 py-2 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold border border-border flex items-center gap-1.5 transition-colors text-text-primary"
              >
                <Save size={14} />
                Enregistrer brouillon
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="px-6 py-2 btn-primary rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/20"
              >
                {isSubmitting || isUploading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send size={15} /> Envoyer
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
