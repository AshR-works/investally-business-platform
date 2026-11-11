'use client';

import { ClipboardEvent, KeyboardEvent, useEffect, useId, useRef } from 'react';
import { applyInput, backspaceOnEmpty, digitsOnly, nextFocus, OTP_LENGTH } from '../../lib/otp';

/**
 * Saisie du code à 6 chiffres en six cases (EXD-06, DDR-0009). Accessible : un groupe nommé, chaque case annoncée
 * « Chiffre n sur 6 », focus automatique sur la case suivante, Retour arrière et flèches, collage du code entier
 * (espaces et tirets ignorés) et saisie automatique du code reçu (`one-time-code` sur la première case).
 * La valeur est la suite des chiffres saisis (0 à 6 caractères).
 */
export function OtpInput({ label, value, onChange, disabled = false, autoFocus = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const labelId = useId();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) boxes.current[0]?.focus();
  }, [autoFocus]);

  const focusBox = (index: number) => {
    const box = boxes.current[index];
    box?.focus();
    box?.select();
  };

  const update = (next: string) => {
    onChange(next);
    focusBox(nextFocus(next));
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !value[index]) {
      event.preventDefault();
      const next = backspaceOnEmpty(value, index);
      onChange(next);
      focusBox(Math.max(0, index - 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(Math.max(0, index - 1));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(Math.min(OTP_LENGTH - 1, index + 1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = digitsOnly(event.clipboardData.getData('text')).slice(0, OTP_LENGTH);
    if (digits) update(digits);
  };

  return (
    <div role="group" aria-labelledby={labelId} className="mb-4">
      <p id={labelId} className="mb-2 mt-0 font-semibold">{label}</p>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <input
            key={index}
            ref={(element) => { boxes.current[index] = element; }}
            value={value[index] ?? ''}
            onChange={(event) => update(applyInput(value, index, event.target.value))}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={onPaste}
            onFocus={(event) => event.target.select()}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            // La première case accepte le code entier (saisie automatique) ; les autres, un seul chiffre.
            maxLength={index === 0 ? OTP_LENGTH : 1}
            aria-label={`Chiffre ${index + 1} sur ${OTP_LENGTH}`}
            disabled={disabled}
            className="m-0 h-14 w-full p-0 text-center text-[length:var(--text-xl)] font-semibold"
          />
        ))}
      </div>
    </div>
  );
}
