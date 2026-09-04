'use client';

import React, { useState, useRef, memo } from 'react';
import { useForm, Controller, Control } from 'react-hook-form';
import {
  Send,
  Save,
  Paperclip,
  X,
  Loader2,
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
      <div className="space-y-1 transition-all">
        {!isCcVisible ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsCcVisible(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-colors py-0.5"
          >
            <UserPlus size={13} />
            + Ajouter des destinataires en copie (CC)
          </button>
        ) : (
          <div className="space-y-1 bg-surface/40 p-2.5 rounded-xl border border-border/60 animate-fade-in-up">
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-hidden">
      <div className="glass-card w-full max-w-2xl h-auto max-h-[85vh] flex flex-col rounded-2xl border border-border/80 shadow-2xl overflow-hidden animate-fade-in-up">
        {/* Compact Header */}
        <div className="py-3 px-5 border-b border-border flex items-center justify-between shrink-0 bg-surface/60 backdrop-blur-md">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Mail size={18} />
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

        {/* Form Wrap */}
        <form
          onSubmit={handleSubmit((values: ComposerFormValues) => handleFormSubmit(values, false))}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {errors.root && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-semibold">
                {errors.root.message}
              </div>
            )}

            {/* Primary Recipients (To) */}
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

            {/* Collapsible CC Section */}
            <div className="relative z-20">
              <CollapsibleCcSection
                control={control}
                toRecipients={watchTo}
                disabled={isSubmitting || isUploading}
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[11px] uppercase font-bold text-text-secondary mb-1 tracking-wider">
                Objet du message *
              </label>
              <input
                type="text"
                placeholder="Objet de votre message..."
                disabled={isSubmitting || isUploading}
                {...register('subject', { required: 'L\'objet est obligatoire' })}
                className={`w-full px-3.5 py-2 rounded-xl bg-surface border text-xs outline-none transition-colors ${
                  errors.subject
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-border focus:border-primary'
                }`}
              />
              {errors.subject && (
                <p className="text-[11px] text-rose-500 font-medium mt-0.5">
                  {errors.subject.message}
                </p>
              )}
            </div>

            {/* Body */}
            <div>
              <label className="block text-[11px] uppercase font-bold text-text-secondary mb-1 tracking-wider">
                Message *
              </label>
              <textarea
                rows={4}
                placeholder="Rédigez votre message ici..."
                disabled={isSubmitting || isUploading}
                {...register('body', { required: 'Le corps du message est obligatoire' })}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-surface border text-xs outline-none leading-relaxed resize-none transition-colors h-28 max-h-36 ${
                  errors.body
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-border focus:border-primary'
                }`}
              />
              {errors.body && (
                <p className="text-[11px] text-rose-500 font-medium mt-0.5">
                  {errors.body.message}
                </p>
              )}
            </div>

            {/* Compact Attachment */}
            <div>
              <label className="block text-[11px] uppercase font-bold text-text-secondary mb-1 tracking-wider">
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
                <div className="py-2 px-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-[85%]">
                    <Paperclip size={14} className="text-primary shrink-0" />
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
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || isUploading}
                  className="w-full py-2 border border-dashed border-border hover:border-primary/50 rounded-xl text-xs text-text-secondary hover:text-primary flex items-center justify-center gap-2 transition-colors"
                >
                  <Paperclip size={14} />
                  Cliquez pour sélectionner un fichier joint
                </button>
              )}
            </div>
          </div>

          {/* Sticky / Fixed Footer Actions */}
          <div className="py-3 px-5 border-t border-border bg-surface/80 backdrop-blur-md flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold hover:bg-surface transition-colors"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSubmitting || isUploading}
              className="px-3.5 py-2 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold border border-border flex items-center gap-1.5 transition-colors text-text-primary"
            >
              <Save size={14} />
              Enregistrer brouillon
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-5 py-2 btn-primary rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/20"
            >
              {isSubmitting || isUploading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Envoi...
                </>
              ) : (
                <>
                  <Send size={15} /> Envoyer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
