import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Plafonds de taille : un mot de passe démesuré ne doit jamais atteindre le hachage (déni de service).
const MAX_PASSWORD_INPUT = 256;

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
