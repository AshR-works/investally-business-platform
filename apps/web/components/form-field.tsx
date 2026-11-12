import { ReactNode } from 'react';
import { Icon } from './icon';

/** Attributs d'un contrôle de formulaire : identifiant, état non conforme annoncé et relié à son message d'erreur. */
export function fieldProps(prefix: string, name: string, error?: string) {
  return {
    id: `${prefix}-${name}`,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? `${prefix}-${name}-error` : undefined,
  };
}

/**
 * Champ de formulaire : libellé relié, contrôle, puis message d'erreur écrit sous le champ (avec pictogramme : la couleur ne porte
 * jamais seule l'état, EXD-16). Composant de premier niveau, défini hors du rendu des fenêtres : sinon les champs seraient
 * recréés, donc le focus perdu, à chaque frappe.
 */
export function FormField({ prefix, name, label, error, children }: { prefix: string; name: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={`${prefix}-${name}`}>{label}</label>
      {children}
      {error && <p id={`${prefix}-${name}-error`} className="field-error"><Icon name="alert" className="size-4" />{error}</p>}
    </div>
  );
}
