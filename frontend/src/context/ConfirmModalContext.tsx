'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect
} from 'react';
import {
  Trash2,
  AlertTriangle,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Info,
  Cpu,
  FileText,
  Users,
  Video,
  Calendar,
  Mail,
  X
} from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  message?: string; // alias for description
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'info';
  badgeText?: string;
  itemName?: string;
  itemDetail?: string;
  icon?: 'trash' | 'warning' | 'logout' | 'shield' | 'info' | 'users' | 'video' | 'calendar' | 'mail' | 'file';
}

interface ConfirmModalContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmModalContext = createContext<ConfirmModalContextType | undefined>(undefined);

export function ConfirmModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    cancelText: string;
    variant: 'danger' | 'warning' | 'primary' | 'info';
    badgeText: string;
    itemName?: string;
    itemDetail?: string;
    icon?: ConfirmOptions['icon'];
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirmer',
    cancelText: 'Annuler',
    variant: 'danger',
    badgeText: 'E-Schola Pro Sécurité • Confirmation'
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    // If another confirm was pending, resolve it with false first
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;

      if (typeof options === 'string') {
        const lower = options.toLowerCase();
        let variant: 'danger' | 'warning' | 'primary' | 'info' = 'danger';
        let icon: ConfirmOptions['icon'] = 'trash';
        let title = 'Confirmation requise';
        let confirmText = 'Confirmer';
        let badgeText = 'E-Schola Pro Sécurité • Confirmation';

        if (lower.includes('supprimer') || lower.includes('suppression')) {
          title = 'Confirmer la suppression ?';
          confirmText = 'Supprimer définitivement';
          variant = 'danger';
          icon = 'trash';
          badgeText = 'E-Schola Pro Sécurité • Suppression';
        } else if (lower.includes('retirer')) {
          title = 'Confirmer le retrait ?';
          confirmText = 'Retirer';
          variant = 'warning';
          icon = 'users';
          badgeText = 'E-Schola Pro Sécurité • Gestion des Membres';
        } else if (lower.includes('déconnecter') || lower.includes('session')) {
          title = 'Révoquer la session ?';
          confirmText = 'Déconnecter';
          variant = 'warning';
          icon = 'logout';
          badgeText = 'E-Schola Pro Sécurité • Révocation Active';
        } else if (lower.includes('clôturer') || lower.includes('fermer')) {
          title = 'Clôturer la visioconférence ?';
          confirmText = 'Clôturer la salle';
          variant = 'warning';
          icon = 'shield';
          badgeText = 'E-Schola Pro Sécurité • Contrôle En Direct';
        } else if (lower.includes('révoquer')) {
          title = "Révoquer l'invitation ?";
          confirmText = 'Révoquer';
          variant = 'warning';
          icon = 'shield';
          badgeText = 'E-Schola Pro Sécurité • Invitations';
        } else if (lower.includes('quitter')) {
          title = 'Quitter sans enregistrer ?';
          confirmText = 'Quitter le quiz';
          variant = 'warning';
          icon = 'warning';
          badgeText = 'E-Schola Pro • Évaluation Pédagogique';
        }

        setModalState({
          isOpen: true,
          title,
          description: options,
          confirmText,
          cancelText: 'Annuler',
          variant,
          badgeText,
          icon
        });
      } else {
        const desc = options.description || options.message || 'Êtes-vous certain de vouloir effectuer cette action ?';
        const variant = options.variant || 'danger';
        const title = options.title || (variant === 'danger' ? 'Confirmer la suppression ?' : 'Confirmation requise');
        const confirmText = options.confirmText || (variant === 'danger' ? 'Confirmer' : 'Valider');
        const cancelText = options.cancelText || 'Annuler';
        const badgeText = options.badgeText || 'E-Schola Pro Sécurité • Confirmation';

        setModalState({
          isOpen: true,
          title,
          description: desc,
          confirmText,
          cancelText,
          variant,
          badgeText,
          itemName: options.itemName,
          itemDetail: options.itemDetail,
          icon: options.icon
        });
      }
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setModalState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  // Keyboard navigation & prevent background scroll
  useEffect(() => {
    if (!modalState.isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalState.isOpen, handleClose]);

  // Determine appropriate icon component
  const renderIcon = () => {
    const iconType = modalState.icon || (modalState.variant === 'danger' ? 'trash' : modalState.variant === 'warning' ? 'warning' : 'shield');
    switch (iconType) {
      case 'trash':
        return <Trash2 size={30} className="drop-shadow-sm" />;
      case 'logout':
        return <LogOut size={30} className="drop-shadow-sm" />;
      case 'shield':
        return <ShieldAlert size={30} className="drop-shadow-sm" />;
      case 'users':
        return <Users size={30} className="drop-shadow-sm" />;
      case 'video':
        return <Video size={30} className="drop-shadow-sm" />;
      case 'calendar':
        return <Calendar size={30} className="drop-shadow-sm" />;
      case 'mail':
        return <Mail size={30} className="drop-shadow-sm" />;
      case 'file':
        return <FileText size={30} className="drop-shadow-sm" />;
      case 'info':
        return <Info size={30} className="drop-shadow-sm" />;
      case 'warning':
      default:
        return <AlertTriangle size={30} className="drop-shadow-sm" />;
    }
  };

  // Badges & Button styles
  const isDanger = modalState.variant === 'danger';
  const isWarning = modalState.variant === 'warning';

  const floatingBadgeClass = isDanger
    ? 'bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-lg shadow-red-600/35 ring-8 ring-red-50 -rotate-3 hover:rotate-0 transition-transform'
    : isWarning
    ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/35 ring-8 ring-amber-50 -rotate-3 hover:rotate-0 transition-transform'
    : 'bg-gradient-to-br from-[#1877f2] to-blue-700 text-white shadow-lg shadow-blue-600/35 ring-8 ring-blue-50 -rotate-3 hover:rotate-0 transition-transform';

  const confirmBtnClass = isDanger
    ? 'w-1/2 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-[0.98] text-white rounded-2xl font-bold shadow-md shadow-red-500/25 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer'
    : isWarning
    ? 'w-1/2 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-[0.98] text-white rounded-2xl font-bold shadow-md shadow-amber-500/25 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer'
    : 'w-1/2 py-3 bg-gradient-to-r from-[#1877f2] to-blue-700 hover:from-blue-600 hover:to-blue-800 active:scale-[0.98] text-white rounded-2xl font-bold shadow-md shadow-blue-500/25 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer';

  return (
    <ConfirmModalContext.Provider value={{ confirm }}>
      {children}

      {/* MODAL 3D CENTRÉ GLOBAL (THÈME E-SCHOLA PRO) */}
      {modalState.isOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md animate-fade-in select-none"
          onClick={() => handleClose(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-confirm-title"
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35),0_0_40px_rgba(24,119,242,0.12)] p-6 sm:p-8 text-center space-y-5 transform transition-all animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Cross Button */}
            <button
              onClick={() => handleClose(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Fermer"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            {/* 3D Floating Glowing Icon Badge */}
            <div className="flex justify-center -mt-2">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${floatingBadgeClass}`}>
                {renderIcon()}
              </div>
            </div>

            {/* Security Chip Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#1877f2] text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
              <Cpu size={13} className="text-[#1877f2] animate-pulse" />
              <span>{modalState.badgeText}</span>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 id="modal-confirm-title" className="text-xl font-black text-slate-900 tracking-tight">
                {modalState.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto whitespace-pre-line">
                {modalState.description}
              </p>
            </div>

            {/* 3D Recessed Target Preview Card (if provided) */}
            {modalState.itemName && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 text-left shadow-inner">
                <div className="w-10 h-10 rounded-xl bg-blue-100/70 border border-blue-200 text-[#1877f2] font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-slate-900 truncate">{modalState.itemName}</p>
                  {modalState.itemDetail && (
                    <p className="text-[11px] text-slate-500 truncate">
                      {modalState.itemDetail}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-2xl font-bold border border-slate-300 transition-all text-xs cursor-pointer shadow-xs"
              >
                {modalState.cancelText}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={confirmBtnClass}
                autoFocus
              >
                {isDanger && <Trash2 size={14} />}
                {isWarning && <AlertTriangle size={14} />}
                {!isDanger && !isWarning && <ShieldCheck size={14} />}
                <span>{modalState.confirmText}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </ConfirmModalContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmModalContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmModalProvider');
  }
  return context;
}
