/** Choix de thème de l'utilisateur : `system` suit le réglage de l'appareil. */
export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'investally-theme';

/** Choix mémorisé (jamais bloquant : `system` si le stockage est indisponible ou illisible). */
export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Applique le choix à la page (attribut `data-theme`, absent = réglage de l'appareil) et le mémorise. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', choice);
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* préférence non mémorisable : le choix reste valable pour la page en cours */
  }
}

/** Thème réellement affiché (le choix, ou le réglage de l'appareil pour `system`). */
export function effectiveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
