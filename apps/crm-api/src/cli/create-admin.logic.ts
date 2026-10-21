/**
 * Arguments de la commande `admin:create` : adresse e-mail et nom affiché du SuperAdmin à créer (jamais le mot de
 * passe).
 */
export interface AdminArgs {
  email: string;
  name: string;
}

/**
 * Lit `--email` et `--name`. Le mot de passe n'est JAMAIS un argument : il apparaîtrait dans l'historique du
 * shell et la liste des processus. Il vient de `BOOTSTRAP_ADMIN_PASSWORD` ou d'une saisie masquée.
 */
export function parseAdminArgs(argv: readonly string[]): AdminArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--password' || arg.startsWith('--password=')) {
      throw new Error("N'indiquez jamais le mot de passe en argument (historique du shell, liste des processus). Utilisez BOOTSTRAP_ADMIN_PASSWORD ou la saisie masquée.");
    }
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split(/=(.*)/s);
      const value = inline !== undefined ? inline : argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`Valeur manquante pour --${key}`);
      values.set(key, value);
    }
  }
  const email = values.get('email')?.trim();
  const name = values.get('name')?.trim();
  if (!email) throw new Error('--email est obligatoire');
  if (!name) throw new Error('--name est obligatoire');
  const unknown = [...values.keys()].filter((key) => key !== 'email' && key !== 'name');
  if (unknown.length > 0) throw new Error(`Option inconnue : --${unknown[0]}`);
  return { email, name };
}

/** Saisie masquée d'une ligne au terminal (rien n'est affiché ni conservé). Impossible hors terminal interactif. */
export function askHidden(question: string, input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stdout): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error("Pas de terminal interactif : fournissez BOOTSTRAP_ADMIN_PASSWORD dans l'environnement"));
      return;
    }
    output.write(question);
    let value = '';
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    const done = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
      output.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return done();
        if (char === '\u0003') return done(new Error('Interrompu')); // Ctrl+C
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    input.on('data', onData);
  });
}
