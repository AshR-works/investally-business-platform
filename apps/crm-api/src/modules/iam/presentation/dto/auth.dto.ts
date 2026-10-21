import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Plafonds de taille : un mot de passe démesuré ne doit jamais atteindre le hachage (déni de service).
const MAX_PASSWORD_INPUT = 256;

/**
 * Corps de connexion : adresse et mot de passe, tailles bornées (un mot de passe démesuré n'atteint jamais le
 * hachage).
 */
export class LoginDto {
  /** Volontairement non validé comme e-mail : une adresse invalide est traitée comme un compte inconnu (401). */
  @ApiProperty({ maxLength: 254 })
  @IsString()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ maxLength: MAX_PASSWORD_INPUT })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_INPUT)
  password!: string;
}

/** Corps de changement de mot de passe : ancien et nouveau, tailles bornées. */
export class ChangePasswordDto {
  @ApiProperty({ maxLength: MAX_PASSWORD_INPUT })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_INPUT)
  currentPassword!: string;

  @ApiProperty({ maxLength: MAX_PASSWORD_INPUT })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_INPUT)
  newPassword!: string;
}

/** Corps d'une vérification MFA : code TOTP à 6 chiffres ou code de secours. */
export class MfaCodeDto {
  /** Code TOTP à 6 chiffres, ou code de secours (ex. `ABCDE-FGHJK`). Plafonné : jamais de chaîne démesurée. */
  @ApiProperty({ maxLength: 32 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}
