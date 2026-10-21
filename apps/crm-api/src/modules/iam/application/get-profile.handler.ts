import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared-kernel';
import { USER_REPOSITORY, UserRepository } from '../domain/auth-repositories';
import { AuthorizationService } from './authorization.service';

/** Ce dont l'interface a besoin pour construire ses menus. Informatif : le serveur re-contrôle chaque requête. */
export interface ProfileView {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: { code: string; scope: string }[];
  mfaEnrolled: boolean;
}

/** Requête de lecture : profil et droits de l'utilisateur connecté, pour construire les menus de l'interface. */
@Injectable()
export class GetProfileHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  /** Renvoie nom, rôles, droits et état du MFA ; informatif seulement, le serveur re-contrôle chaque requête. */
  async execute(userId: string): Promise<ProfileView> {
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Session invalide ou expirée');
    const [roles, context] = await Promise.all([this.users.roleCodesOf(userId), this.authorization.contextFor(userId)]);
    return {
      userId,
      email: user.email.value,
      displayName: user.displayName,
      roles: [...roles],
      permissions: context.grants.map((grant) => ({ code: grant.permission, scope: grant.scope })),
      mfaEnrolled: user.mfaEnabled,
    };
  }
}
