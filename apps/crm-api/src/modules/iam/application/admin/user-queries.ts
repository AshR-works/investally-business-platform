import { Inject, Injectable } from '@nestjs/common';
import { DomainError, Page } from '../../../../shared-kernel';
import { USER_REPOSITORY, UserRepository } from '../../domain/auth-repositories';
import { UserStatus } from '../../domain/user';
import type { UserStatusName } from '../access-types';
import { ROLE_CATALOG_READER, RoleCatalogReader, RoleView, UserView, toUserView } from './user-view';

const MAX_PAGE_SIZE = 100;

/** Paramètres de la liste d'administration : page, taille, recherche et filtre de statut. */
export interface ListUsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatusName;
}

/** Requête de lecture : liste paginée des utilisateurs avec leurs rôles. */
@Injectable()
export class ListUsersHandler {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  /** Borne la page (taille ≤ 100) et renvoie les utilisateurs avec leurs rôles en deux requêtes. */
  async execute(query: ListUsersQuery): Promise<Page<UserView>> {
    const page = Math.max(1, Math.floor(query.page));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize)));
    const result = await this.users.list({ page, pageSize, search: query.search?.trim() || undefined, status: query.status as UserStatus | undefined });
    const roles = await this.users.rolesOfMany(result.items.map((user) => user.id));
    return { ...result, items: result.items.map((user) => toUserView(user, roles.get(user.id) ?? [])) };
  }
}

/** Requête de lecture : un utilisateur et ses rôles. */
@Injectable()
export class GetUserHandler {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  /** Renvoie l'utilisateur ou lève « introuvable ». */
  async execute(userId: string): Promise<UserView> {
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError('NOT_FOUND', 'Utilisateur introuvable');
    return toUserView(user, await this.users.roleCodesOf(user.id));
  }
}

/** Requête de lecture : catalogue des rôles et de leurs permissions. */
@Injectable()
export class ListRolesHandler {
  constructor(@Inject(ROLE_CATALOG_READER) private readonly roles: RoleCatalogReader) {}

  /** Renvoie tous les rôles avec leurs permissions et portées. */
  execute(): Promise<RoleView[]> {
    return this.roles.list();
  }
}
