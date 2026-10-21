/** Ports sortants du MFA, implémentés par l'Infrastructure. */

/** Chiffrement du secret TOTP au repos. `context` (identifiant de l'utilisateur) est authentifié avec le chiffré :
 *  un secret recopié sur un autre compte ne peut pas être déchiffré. */
export interface SecretCipher {
  encrypt(plain: string, context: string): string;
  /** Lève une erreur si le chiffré a été altéré ou si le contexte ne correspond pas. */
  decrypt(blob: string, context: string): string;
}

/** Port : génération d'un secret TOTP. */
export interface TotpGenerator {
  /** Nouveau secret aléatoire de 160 bits, en base32 (format des applications d'authentification). */
  generateSecret(): string;
}

/** Port : génération d'un lot de codes de secours. */
export interface RecoveryCodeGenerator {
  /** `count` codes uniques, en forme normalisée (10 caractères, sans tiret). */
  generate(count: number): string[];
}

/** Port : stockage des codes de secours (hachages) et consommation atomique d'un code. */
export interface RecoveryCodeRepository {
  /** Remplace TOUS les codes de l'utilisateur par ces hachages (les anciens deviennent invalides). */
  replaceAll(userId: string, hashes: { id: string; hash: string }[], now: Date): Promise<void>;
  deleteAll(userId: string): Promise<void>;
  /** Codes encore utilisables (non consommés). */
  listUnused(userId: string): Promise<{ id: string; hash: string }[]>;
  /** Consomme atomiquement : `false` si un autre appel l'a déjà fait. */
  consume(id: string, now: Date): Promise<boolean>;
  countUnused(userId: string): Promise<number>;
}

export const SECRET_CIPHER = Symbol('SecretCipher');
export const TOTP_GENERATOR = Symbol('TotpGenerator');
export const RECOVERY_CODE_GENERATOR = Symbol('RecoveryCodeGenerator');
export const RECOVERY_CODE_REPOSITORY = Symbol('RecoveryCodeRepository');
