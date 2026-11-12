import { Logger } from '@nestjs/common';
import { AppConfig } from '../../../shared-kernel';
import { EmailMessage, EmailResult, EmailSender, invalidReason } from '../application/email-sender';

type Credentials = NonNullable<AppConfig['email']['microsoft365']>;
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 10_000;
/** Marge avant l'expiration réelle du jeton : on le renouvelle un peu plus tôt. */
const TOKEN_MARGIN_MS = 120_000;
const SCOPE = 'https://graph.microsoft.com/.default';

/**
 * Envoi via Microsoft Graph (`POST /users/{expéditeur}/sendMail`) avec les identifiants de l'APPLICATION
 * (flux « client credentials » : aucun utilisateur humain, une boîte d'expédition dédiée, permission `Mail.Send`).
 *
 * ⚠ Testé contre un FAUX serveur uniquement : jamais contre le vrai Microsoft 365 (accès non disponibles).
 *
 * Limites connues, notées en dette : une seule tentative après un jeton refusé ; pas de file d'attente ni de nouvel essai
 * différé (outbox prévue) ; pas de disjoncteur.
 * Aucun secret (clé client, jeton) n'apparaît jamais dans un message d'erreur ni un journal.
 */
export class MicrosoftGraphEmailSender implements EmailSender {
  private readonly logger = new Logger(MicrosoftGraphEmailSender.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly credentials: Credentials,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Envoie par Microsoft Graph avec un jeton d'application ; toute erreur devient une issue d'échec sans secret dans
   * les journaux. Jamais testé contre le service réel.
   */
  async send(message: EmailMessage): Promise<EmailResult> {
    const reason = invalidReason(message);
    if (reason) {
      this.logger.warn(`E-mail refusé avant envoi : ${reason}`);
      return { ok: false, reason: 'INVALID' };
    }

    // Une seule nouvelle tentative, et seulement si le jeton a été refusé (401) : il a pu être révoqué avant son expiration.
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.token();
      if (!token) return { ok: false, reason: 'UNAVAILABLE' };

      let response: Response;
      try {
        response = await this.fetchImpl(this.sendUrl(), {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(this.payload(message)),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        this.logger.warn('Envoi Microsoft Graph impossible (réseau ou délai dépassé)');
        return { ok: false, reason: 'UNAVAILABLE' };
      }

      if (response.status === 202) return { ok: true };
      if (response.status === 401 && attempt === 0) {
        this.cachedToken = null;
        continue;
      }
      this.logger.warn(`Microsoft Graph a répondu ${response.status} à l'envoi`);
      return { ok: false, reason: response.status === 429 || response.status >= 500 ? 'UNAVAILABLE' : 'REJECTED' };
    }
    return { ok: false, reason: 'REJECTED' };
  }

  /** Adresse de l'API `sendMail` de la boîte d'expédition configurée. */
  private sendUrl(): string {
    return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.credentials.sender)}/sendMail`;
  }

  /** Corps de la requête Graph : sujet, contenu (texte ou HTML) et destinataire. */
  private payload(message: EmailMessage) {
    return {
      message: {
        subject: message.subject,
        body: message.html ? { contentType: 'HTML', content: message.html } : { contentType: 'Text', content: message.text },
        toRecipients: [{ emailAddress: { address: message.to } }],
      },
      // Pas de copie dans les éléments envoyés : les e-mails de sécurité ne doivent pas s'accumuler dans une boîte partagée.
      saveToSentItems: false,
    };
  }

  /** Jeton d'application, mis en cache jusqu'à (expiration − marge). `null` si l'obtention échoue. */
  private async token(): Promise<string | null> {
    if (this.cachedToken && this.now() < this.cachedToken.expiresAt) return this.cachedToken.value;

    const { tenantId, clientId, clientSecret } = this.credentials;
    let response: Response;
    try {
      response = await this.fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: SCOPE, grant_type: 'client_credentials' }).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      this.logger.warn("Obtention du jeton Microsoft impossible (réseau ou délai dépassé)");
      return null;
    }
    if (!response.ok) {
      // Le corps de la réponse peut citer l'identifiant d'application : on n'en garde que le code HTTP.
      this.logger.warn(`Microsoft a refusé l'authentification de l'application (HTTP ${response.status})`);
      return null;
    }
    try {
      const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
      if (typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') throw new Error('réponse inattendue');
      this.cachedToken = { value: body.access_token, expiresAt: this.now() + body.expires_in * 1000 - TOKEN_MARGIN_MS };
      return body.access_token;
    } catch {
      this.logger.warn('Réponse du service de jetons Microsoft inattendue');
      return null;
    }
  }
}
