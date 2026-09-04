'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Search, Loader2, User as UserIcon, Check } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { UserMinimalRead } from '@/types/recipient';

export interface RecipientInputProps {
  label?: string;
  placeholder?: string;
  selectedRecipients: UserMinimalRead[];
  onChange: (recipients: UserMinimalRead[]) => void;
  alreadySelectedUsers?: UserMinimalRead[]; // Combined To + CC list for deduplication
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const RecipientInput: React.FC<RecipientInputProps> = ({
  label,
  placeholder = 'Rechercher par nom, email ou prénom...',
  selectedRecipients,
  onChange,
  alreadySelectedUsers,
  error,
  disabled = false,
  className = '',
}) => {
  const [queryText, setQueryText] = useState('');
  const [suggestions, setSuggestions] = useState<UserMinimalRead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 300ms Debounced search with AbortController cancellation
  useEffect(() => {
    const q = queryText.trim();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!q) {
      setSuggestions([]);
      setIsLoading(false);
      setIsDropdownOpen(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const response = await apiClient.get<UserMinimalRead[]>('/users/search', {
          params: { q, limit: 10 },
          signal: controller.signal,
        });
        setSuggestions(response.data || []);
        setHighlightedIndex(0);
        setIsDropdownOpen(true);
      } catch (err: any) {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED' && !axiosIsCancel(err)) {
          console.error('Error fetching recipient suggestions:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryText]);

  // Helper for Axios cancel check
  function axiosIsCancel(err: any): boolean {
    return err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';
  }

  // Deduplicate against all already selected recipients (To + CC)
  const filteredSuggestions = useMemo(() => {
    const excludedIds = new Set(
      (alreadySelectedUsers || selectedRecipients).map((u) => String(u.id))
    );
    return suggestions.filter((u) => !excludedIds.has(String(u.id)));
  }, [suggestions, alreadySelectedUsers, selectedRecipients]);

  const addRecipient = useCallback(
    (user: UserMinimalRead) => {
      const exists = selectedRecipients.some((r) => String(r.id) === String(user.id));
      if (!exists) {
        onChange([...selectedRecipients, user]);
      }
      setQueryText('');
      setSuggestions([]);
      setIsDropdownOpen(false);
      inputRef.current?.focus();
    },
    [selectedRecipients, onChange]
  );

  const removeRecipient = useCallback(
    (id: number | string) => {
      onChange(selectedRecipients.filter((r) => String(r.id) !== String(id)));
    },
    [selectedRecipients, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isDropdownOpen && filteredSuggestions.length > 0) {
        setIsDropdownOpen(true);
      } else if (filteredSuggestions.length > 0) {
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (isDropdownOpen && filteredSuggestions.length > 0 && highlightedIndex >= 0) {
        e.preventDefault();
        addRecipient(filteredSuggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownOpen(false);
    } else if (e.key === 'Backspace' && queryText === '' && selectedRecipients.length > 0) {
      removeRecipient(selectedRecipients[selectedRecipients.length - 1].id);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    const lower = (role || '').toLowerCase();
    if (lower.includes('admin')) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    if (lower.includes('formateur') || lower.includes('prof')) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (lower.includes('pedagog')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    if (lower.includes('stagiaire')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (lower.includes('employer') || lower.includes('employe')) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs uppercase font-bold text-text-secondary tracking-wider">
          {label}
        </label>
      )}

      <div ref={containerRef} className="relative">
        <div
          onClick={() => inputRef.current?.focus()}
          className={`min-h-[44px] p-2 rounded-xl bg-surface border transition-colors flex flex-wrap items-center gap-1.5 cursor-text ${
            error
              ? 'border-rose-500 focus-within:border-rose-500 ring-1 ring-rose-500/20'
              : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30'
          } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {/* Selected Recipient Badges */}
          {selectedRecipients.map((recipient) => (
            <span
              key={String(recipient.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-text-primary text-xs font-medium group hover:border-primary/40 transition-all animate-scale-in"
            >
              {recipient.avatar_url ? (
                <img
                  src={recipient.avatar_url}
                  alt={recipient.full_name}
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                  {(recipient.full_name || recipient.email || 'U').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate max-w-[140px] font-semibold">{recipient.full_name}</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider ${getRoleBadgeClass(
                  recipient.role
                )}`}
              >
                {recipient.role}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeRecipient(recipient.id);
                }}
                className="text-text-secondary hover:text-rose-400 p-0.5 rounded hover:bg-rose-500/10 transition-colors ml-0.5"
                title="Supprimer ce destinataire"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Input field */}
          <div className="flex-1 min-w-[140px] flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={queryText}
              disabled={disabled}
              onChange={(e) => setQueryText(e.target.value)}
              onFocus={() => {
                if (filteredSuggestions.length > 0) setIsDropdownOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={selectedRecipients.length === 0 ? placeholder : ''}
              className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-secondary/60 outline-none border-none p-1"
            />

            {isLoading && (
              <Loader2 size={14} className="animate-spin text-primary shrink-0 mr-1.5" />
            )}
          </div>
        </div>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-border/40 animate-fade-in-up">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((user, idx) => {
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={String(user.id)}
                    onClick={() => addRecipient(user)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`p-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                      isHighlighted
                        ? 'bg-primary/15 text-text-primary'
                        : 'hover:bg-primary/10 text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name}
                          className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary truncate">
                            {user.full_name}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider ${getRoleBadgeClass(
                              user.role
                            )}`}
                          >
                            {user.role}
                          </span>
                        </div>
                        {user.email && (
                          <p className="text-[11px] text-text-secondary truncate">{user.email}</p>
                        )}
                      </div>
                    </div>

                    {isHighlighted && (
                      <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">
                        Entrée
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-xs text-text-secondary text-center">
                {isLoading ? 'Recherche des destinataires...' : 'Aucun destinataire correspondant trouvé'}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-rose-500 font-medium pl-1">{error}</p>}
    </div>
  );
};
