'use client';

import { Icon, type IconName } from './icon';

/**
 * Bouton à pictogramme seul. Le nom accessible (`aria-label`) et l'info-bulle (`title`) sont obligatoires : un pictogramme sans texte ne se lit pas au lecteur d'écran
 * et ne se devine pas toujours. `outlined` ajoute une bordure (actions dans un tableau) ; sans, le bouton se fond dans l'en-tête d'une fenêtre.
 */
export function IconButton({ icon, label, onClick, outlined = false, disabled = false }: { icon: IconName; label: string; onClick: () => void; outlined?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={outlined ? 'icon-button outlined' : 'icon-button'} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} className="size-5" />
    </button>
  );
}
