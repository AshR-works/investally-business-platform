import type { ReactNode } from 'react';
import type { Tone } from '../data/badge';
import { Icon, type IconName } from '../icon';

const STYLES: Record<Exclude<Tone, 'neutral'>, { box: string; icon: IconName }> = {
  ok: { box: 'border-ok bg-ok-bg text-ok', icon: 'shield' },
  warn: { box: 'border-warn bg-warn-bg text-warn', icon: 'logout' },
  bad: { box: 'border-bad bg-bad-bg text-bad', icon: 'close' },
  info: { box: 'border-info bg-info-bg text-info', icon: 'search' },
};

/**
 * Encadré de message des écrans d'accès (confirmation, avertissement, erreur). `role="alert"` pour une erreur à annoncer
 * immédiatement, `role="status"` pour une confirmation. Le sens est porté par le texte et le pictogramme, pas par la
 * couleur seule.
 */
export function AuthNotice({ tone, role, title, children }: { tone: Exclude<Tone, 'neutral'>; role: 'alert' | 'status'; title?: string; children?: ReactNode }) {
  const style = STYLES[tone];
  return (
    <div role={role} className={`mb-4 flex gap-3 rounded-panel border px-4 py-3 ${style.box}`}>
      <Icon name={style.icon} className="mt-0.5 size-5" />
      <div className="min-w-0 text-[length:var(--text-sm)] leading-snug">
        {title && <strong className="block">{title}</strong>}
        {children}
      </div>
    </div>
  );
}
