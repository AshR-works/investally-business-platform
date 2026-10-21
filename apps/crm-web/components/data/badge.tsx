import type { ReactNode } from 'react';

/** Teinte d'un badge : le sens est porté par le TEXTE et le point, jamais par la couleur seule (WCAG 1.4.1). */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

const TONES: Record<Tone, string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
  neutral: 'bg-surface-2 text-ink-2',
};

/** Badge d'état (statut, rôle, indicateur) : pastille arrondie, point de couleur et libellé. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
