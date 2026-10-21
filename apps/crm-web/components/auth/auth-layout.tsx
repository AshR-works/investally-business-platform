import type { ReactNode } from 'react';
import { PageHeading } from '../page-heading';

/** Barres décoratives de la carte d'accueil (hauteurs en %), reprises du prototype de design. */
const BARS = [35, 52, 44, 68, 60, 82, 100];

/**
 * Gabarit des écrans d'accès (EXD-06) : carte sombre d'accueil à gauche (masquée sur mobile), formulaire à droite avec
 * logo, indicateur d'étape, titre et description. Le titre renseigne aussi le titre du document.
 */
export function AuthLayout({ title, documentTitle, description, step, children, footer }: {
  title: string;
  /** Titre du document quand il doit différer du titre affiché (ex. deux écrans « Lien invalide »). */
  documentTitle?: string;
  description?: ReactNode;
  /** Étape courante d'un parcours en plusieurs écrans (ex. connexion = 1 sur 2). */
  step?: { current: number; total: number };
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-bg min-[901px]:grid-cols-[1.05fr_1fr]">
      <section aria-hidden="true" className="relative hidden flex-col justify-between overflow-hidden bg-hero p-12 text-hero-ink min-[901px]:flex">
        <div />
        <div>
          <p className="m-0 max-w-[14ch] font-display text-4xl font-bold leading-[1.15] tracking-tight">Simplifier, connecter, investir.</p>
          <p className="mt-4 max-w-[32ch] text-hero-muted">Une seule plateforme pour piloter le développement commercial, la formation et les opérations de l’entreprise.</p>
        </div>
        <div className="absolute bottom-12 right-12 flex h-44 w-40 items-end gap-1.5 opacity-35">
          {BARS.map((height, index) => <span key={index} className="flex-1 rounded-t-chip bg-brand" style={{ height: `${height}%` }} />)}
        </div>
      </section>

      <section className="grid place-items-center p-8 max-[900px]:p-5">
        <div className="w-full max-w-[420px]">
          <img src="/brand/logo-investally-square.png" alt="Investally" width={700} height={507} className="logo-img mb-6 h-auto w-36" />
          {step && (
            <div className="mb-4">
              <p className="sr-only">Étape {step.current} sur {step.total}</p>
              <div aria-hidden="true" className="flex gap-1.5">
                {Array.from({ length: step.total }, (_, index) => (
                  <i key={index} className={`h-1 w-10 rounded-full ${index < step.current ? 'bg-brand-strong' : 'bg-line-strong'}`} />
                ))}
              </div>
            </div>
          )}
          <PageHeading title={documentTitle} className="m-0 mb-2 text-[length:var(--text-xl)]">{title}</PageHeading>
          {description && <div className="mb-6 text-ink-2">{description}</div>}
          {children}
          {footer && <div className="mt-6 border-t border-line pt-4 text-[length:var(--text-sm)] text-ink-2">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
