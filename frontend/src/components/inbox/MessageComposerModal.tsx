'use client';

import React, { useState, useRef, useCallback, memo } from 'react';
import { useForm, Controller, Control } from 'react-hook-form';
import {
  Send,
  Save,
  Paperclip,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Mail,
} from 'lucide-react';
import { RecipientInput } from './RecipientInput';
import { UserMinimalRead, ComposerFormValues } from '@/types/recipient';
import { apiClient } from '@/lib/api';

export interface MessageComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialToRecipients?: UserMinimalRead[];
  initialSubject?: string;
  initialBody?: string;
}

/**
 * Isolated, memoized CC Collapse Section component to prevent re-rendering the whole composer
 * when toggling CC input visibility.
 */
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
          <div className="space-y-1 bg-surface/40 p-3 rounded-xl border border-border/60 animate-fade-in-up">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs uppercase font-bold text-text-secondary tracking-wider">
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

export const MessageComposerModal: React.FC<MessageComposerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialToRecipients = [],
  initialSubject = '',
  initialBody = '',
}) => {
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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

  const watchTo = watch('to') || [];
  const watchCc = watch('cc') || [];

  if (!isOpen) return null;

  const uploadAttachment = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return {
        url: res.data.file_url,
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
    // Validate that to.length >= 1
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

      // Send to each primary recipient (or draft)
      const primaryRecipients = values.to && values.to.length > 0 ? values.to : [null];

      for (let i = 0; i < primaryRecipients.length; i++) {
        const recipient = primaryRecipients[i];
        const payload = {
          recipient_id: recipient ? Number(recipient.id) : null,
          recipient_email: recipient ? recipient.email : null,
          cc_recipient_ids: ccIds,
          cc_emails: ccEmails,
          subject: values.subject ? values.subject.trim() : '',
          body: values.body,
          attachment_url: fileData?.url || null,
          attachment_name: fileData?.name || null,
          attachment_type: fileData?.type || null,
          is_draft: isDraft,
        };

        await apiClient.post('/messages', payload);
      }

      reset();
      setAttachedFile(null);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting message:', err);
      setError('root', {
        type: 'manual',
        message: err.response?.data?.detail || 'Une erreur est survenue lors de l\'envoi du message.',
      });
    }
  };

  const onSaveDraft = () => {
    handleSubmit((values: ComposerFormValues) => handleFormSubmit(values, true))();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card max-w-2xl w-full p-6 rounded-2xl border border-border space-y-5 animate-fade-in-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-base">
            <Mail size={20} />
            <h2>Nouveau Message</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit((values: ComposerFormValues) => handleFormSubmit(values, false))}
          className="space-y-4 overflow-y-auto pr-1 flex-1"
        >
          {errors.root && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-semibold">
              {errors.root.message}
            </div>
          )}

          {/* Primary Recipients (To) */}
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

          {/* Collapsible CC Section (Isolated to prevent unnecessary re-renders) */}
          <CollapsibleCcSection
            control={control}
            toRecipients={watchTo}
            disabled={isSubmitting || isUploading}
          />

          {/* Subject */}
          <div>
            <label className="block text-xs uppercase font-bold text-text-secondary mb-1.5 tracking-wider">
              Objet du message *
            </label>
            <input
              type="text"
              placeholder="Objet de votre message..."
              disabled={isSubmitting || isUploading}
              {...register('subject', { required: 'L\'objet est obligatoire' })}
              className={`w-full px-4 py-2.5 rounded-xl bg-surface border text-xs outline-none transition-colors ${
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

          {/* Body */}
          <div>
            <label className="block text-xs uppercase font-bold text-text-secondary mb-1.5 tracking-wider">
              Message *
            </label>
            <textarea
              rows={5}
              placeholder="Rédigez votre message ici..."
              disabled={isSubmitting || isUploading}
              {...register('body', { required: 'Le corps du message est obligatoire' })}
              className={`w-full px-4 py-3 rounded-xl bg-surface border text-xs outline-none leading-relaxed resize-none transition-colors ${
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

          {/* Attachment */}
          <div>
            <label className="block text-xs uppercase font-bold text-text-secondary mb-1.5 tracking-wider">
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
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate max-w-[85%]">
                  <Paperclip size={16} className="text-primary shrink-0" />
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
                  className="text-text-secondary hover:text-rose-400 p-1 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || isUploading}
                className="w-full py-2.5 border-2 border-dashed border-border hover:border-primary/50 rounded-xl text-xs text-text-secondary hover:text-primary flex items-center justify-center gap-2 transition-colors"
              >
                <Paperclip size={16} />
                Cliquez pour sélectionner un fichier joint
              </button>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5 border-t border-border mt-4">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSubmitting || isUploading}
              className="w-full sm:w-auto px-4 py-2.5 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold border border-border flex items-center justify-center gap-1.5 transition-colors text-text-primary"
            >
              <Save size={15} />
              Enregistrer brouillon
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="w-full sm:flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
            >
              {isSubmitting || isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={16} /> Envoyer
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-text-secondary hover:text-text-primary rounded-xl text-xs transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
