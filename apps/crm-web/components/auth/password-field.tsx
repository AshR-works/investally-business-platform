'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { PASSWORD_AUTO_HIDE_MS } from '../../lib/password';
import { Icon } from '../icon';

/**
 * Champ mot de passe avec bouton « œil » (EXD-12). UN SEUL composant pour toute l'application : aucun autre écran ne
 * déclare de champ `type="password"` (un test le vérifie).
 *
 * Le mot de passe affiché est remasqué à l'envoi du formulaire, quand l'onglet n'est plus visible et après 30 s. L'état
 * n'est jamais conservé. La correction orthographique est coupée (le texte ne doit pas partir vers un service tiers).
 */
export function PasswordField({ label, value, onChange, autoComplete, autoFocus, invalid, required = true }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
  invalid?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    const timer = window.setTimeout(hide, PASSWORD_AUTO_HIDE_MS);
    const onVisibility = () => { if (document.hidden) hide(); };
    const form = box.current?.closest('form');
    document.addEventListener('visibilitychange', onVisibility);
    form?.addEventListener('submit', hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      form?.removeEventListener('submit', hide);
    };
  }, [visible]);

  return (
    <div className="mb-[.9rem]">
      <label htmlFor={id} className="mb-0 block">{label}</label>
      <div ref={box} className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={256}
          required={required}
          aria-invalid={invalid || undefined}
          className="pr-11"
        />
        <button
          type="button"
          aria-label="Afficher le mot de passe"
          aria-pressed={visible}
          title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 mt-[.15rem] flex size-9 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Icon name={visible ? 'eye-off' : 'eye'} />
        </button>
      </div>
    </div>
  );
}
