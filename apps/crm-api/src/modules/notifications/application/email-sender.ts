export interface EmailMessage {
  /** Destinataire unique (les envois en masse n'existent pas dans le CRM). */
  to: string;
  subject: string;
  /** Contenu texte brut : toujours fourni. */
  text: string;
  /** Variante HTML facultative. Le contenu dynamique doit être échappé par l'appelant. */
  html?: string;
}

/**
 * Résultat d'un envoi. Jamais d'exception ni de détail technique :
 * - `INVALID` : message refusé avant envoi (adresse, en-têtes) ;
 * - `REJECTED` : le service a refusé (configuration, permissions, destinataire) : inutile de réessayer ;
 * - `UNAVAILABLE` : indisponibilité passagère (réseau, limitation de débit, erreur serveur) : réessayer plus tard.
 */
export type EmailResult = { ok: true } | { ok: false; reason: 'INVALID' | 'REJECTED' | 'UNAVAILABLE' };

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailResult>;
}

export const EMAIL_SENDER = Symbol('EmailSender');

const MAX_SUBJECT = 200;
const MAX_BODY = 100_000;
const ADDRESS = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]{2,}$/;

/**
 * Validation commune avant tout envoi. Refuse les retours à la ligne et caractères de contrôle dans l'adresse et
 * le sujet (injection d'en-têtes SMTP : `\r\nBcc: ...`), les adresses multiples ou avec nom affiché, et les messages démesurés.
 * Retourne `null` si le message est acceptable, sinon la raison (à journaliser, jamais à renvoyer à un utilisateur).
 */
export function invalidReason(message: EmailMessage): string | null {
  const control = /[\u0000-\u001f\u007f\u2028\u2029]/;
  if (typeof message.to !== 'string' || message.to.length > 254 || control.test(message.to) || !ADDRESS.test(message.to)) {
    return 'adresse du destinataire invalide';
  }
  if (typeof message.subject !== 'string' || message.subject.length === 0 || message.subject.length > MAX_SUBJECT || control.test(message.subject)) {
    return 'sujet invalide';
  }
  if (typeof message.text !== 'string' || message.text.length === 0 || message.text.length > MAX_BODY) return 'contenu invalide';
  if (message.html !== undefined && (typeof message.html !== 'string' || message.html.length > MAX_BODY)) return 'contenu HTML invalide';
  return null;
}
