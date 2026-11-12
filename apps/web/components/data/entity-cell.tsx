/** Initiales (deux lettres au plus) d'un nom, pour l'étiquette graphique d'une ligne. */
export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?';
}

/**
 * Cellule « entité » des tableaux : étiquette à initiales (carrée pour une organisation, ronde pour une personne),
 * nom en gras et ligne secondaire. L'étiquette est décorative : le nom est déjà lu.
 */
export function EntityCell({ name, subtitle, round = false }: { name: string; subtitle?: string | null; round?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center bg-brand-soft text-xs font-bold text-brand-strong ${round ? 'rounded-full' : 'rounded-control'}`}>
        {initialsOf(name)}
      </span>
      <div className="min-w-0 leading-tight">
        <strong className="block truncate">{name}</strong>
        {subtitle && <span className="block truncate text-xs text-ink-2">{subtitle}</span>}
      </div>
    </div>
  );
}
