import { passwordRules } from '../../lib/password';
import { Icon } from '../icon';

/**
 * Champs « nouveau mot de passe » + confirmation, avec les règles visibles en direct (chacune annoncée « respectée » ou
 * « à respecter » aux lecteurs d'écran) et l'alerte de non-concordance. Partagés par l'activation d'un compte invité et
 * la réinitialisation du mot de passe.
 */
export function NewPasswordFields({ password, confirmation, onPassword, onConfirmation }: {
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
}) {
  const rules = passwordRules(password);
  const mismatch = confirmation.length > 0 && confirmation !== password;
  return (
    <>
      <label>
        Nouveau mot de passe
        <input type="password" value={password} onChange={(e) => onPassword(e.target.value)} autoComplete="new-password" maxLength={256} required autoFocus />
      </label>
      <ul aria-label="Règles du mot de passe" className="mb-4 mt-0 flex list-none flex-col gap-1 p-0 text-[length:var(--text-sm)]">
        {rules.map((rule) => (
          <li key={rule.label} className={`flex items-center gap-2 ${rule.met ? 'text-ok' : 'text-ink-2'}`}>
            <Icon name={rule.met ? 'shield' : 'close'} className="size-4" />
            <span>{rule.label}<span className="sr-only"> : {rule.met ? 'respectée' : 'à respecter'}</span></span>
          </li>
        ))}
      </ul>
      <label>
        Confirmez le mot de passe
        <input type="password" value={confirmation} onChange={(e) => onConfirmation(e.target.value)} autoComplete="new-password" maxLength={256} required aria-invalid={mismatch} />
      </label>
      {mismatch && <p role="alert" className="mb-4 mt-0 text-[length:var(--text-sm)] text-bad">Les deux mots de passe sont différents.</p>}
    </>
  );
}
