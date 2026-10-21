import { createHmac, timingSafeEqual } from 'node:crypto';

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Pas de tolérance de part et d'autre du pas courant (dérive d'horloge du téléphone) : ±1 = ±30 s. */
export const TOTP_WINDOW = 1;

/** HOTP (RFC 4226) : code à `digits` chiffres pour un compteur donné. SHA-1 : imposé par les applications d'authentification. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/** Pas de temps (RFC 6238) correspondant à un instant. */
export function timeStepOf(nowMs: number, stepSeconds = TOTP_STEP_SECONDS): number {
  return Math.floor(nowMs / 1000 / stepSeconds);
}

/** Code TOTP à 6 chiffres (RFC 6238) pour un secret et un instant donnés ; sert aux tests et à l'enrôlement. */
export function totp(secret: Buffer, nowMs: number, digits = TOTP_DIGITS): string {
  return hotp(secret, timeStepOf(nowMs), digits);
}

export type TotpVerification = { ok: true; step: number } | { ok: false };

/** Compare deux codes en temps constant (aucune information ne fuit par la durée de la comparaison). */
function equalCodes(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Vérifie un code TOTP dans la fenêtre ±TOTP_WINDOW et refuse le REJEU : un pas de temps déjà utilisé
 * (ou antérieur) est rejeté (RFC 6238 §5.2). Toutes les comparaisons sont en temps constant et tous les
 * pas de la fenêtre sont évalués (pas de sortie anticipée qui révélerait lequel correspond).
 */
export function verifyTotp(input: {
  secret: Buffer;
  code: string;
  nowMs: number;
  lastUsedStep: number | null;
}): TotpVerification {
  const code = (input.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) return { ok: false };

  const current = timeStepOf(input.nowMs);
  let matched: number | null = null;
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const step = current + offset;
    if (step < 0) continue;
    if (equalCodes(hotp(input.secret, step), code) && matched === null) matched = step;
  }
  if (matched === null) return { ok: false };
  if (input.lastUsedStep !== null && matched <= input.lastUsedStep) return { ok: false };
  return { ok: true, step: matched };
}

/** URI `otpauth://` à encoder en QR code côté interface (Microsoft/Google Authenticator). */
export function otpauthUri(input: { secretBase32: string; accountName: string; issuer: string }): string {
  const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.accountName)}`;
  const params = new URLSearchParams({
    secret: input.secretBase32,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
