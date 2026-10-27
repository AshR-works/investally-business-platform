/** Nom des fichiers de codes de secours : aucune donnée personnelle (le fichier peut être perdu ou partagé). */
export const CODES_FILE_NAME = 'investally-codes-de-secours.txt';

/**
 * Contenu du fichier texte et de la copie dans le presse-papiers. Ni nom, ni adresse e-mail, ni identifiant : seulement
 * le service, la date et les codes.
 */
export function codesFileText(codes: readonly string[], generatedAt: Date): string {
  const date = generatedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    'Investally - codes de secours',
    `Générés le ${date}`,
    '',
    'Chaque code ne sert qu’une seule fois, si vous perdez votre application d’authentification.',
    'Rangez ce fichier dans un gestionnaire de mots de passe, puis supprimez-le de vos téléchargements.',
    '',
    ...codes,
    '',
  ].join('\n');
}
