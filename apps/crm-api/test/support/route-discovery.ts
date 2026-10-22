import 'reflect-metadata';
import { INestApplication, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { MIN_SCOPE_KEY, PERMISSION_KEY } from '../../src/modules/iam/presentation/protected.decorator';

export interface Route { key: string; guards: string[]; permission: string | undefined; minScope: string | undefined }

/**
 * Parcourt TOUTES les routes réellement montées par l'application. Une nouvelle route doit être soit protégée par
 * `@Protected('permission')` (permission du catalogue), soit déclarée ici explicitement comme publique ou
 * « authentifiée seulement » : impossible d'ajouter un endpoint ouvert par simple oubli.
 */
export function discoverRoutes(app: INestApplication): Route[] {
  const routes: Route[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      if (!wrapper.metatype) continue;
      const base = Reflect.getMetadata(PATH_METADATA, wrapper.metatype) as string | undefined;
      const classGuards = (Reflect.getMetadata(GUARDS_METADATA, wrapper.metatype) ?? []) as { name: string }[];
      const prototype = wrapper.metatype.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        if (method === undefined) continue;
        const path = (Reflect.getMetadata(PATH_METADATA, handler) as string | undefined) ?? '';
        const guards = [...classGuards, ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as { name: string }[])];
        routes.push({
          key: `${RequestMethod[method]} /${[base, path].filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '')}`,
          guards: guards.map((guard) => guard.name),
          permission: Reflect.getMetadata(PERMISSION_KEY, handler) as string | undefined,
          minScope: Reflect.getMetadata(MIN_SCOPE_KEY, handler) as string | undefined,
        });
      }
    }
  }
  return routes.sort((a, b) => a.key.localeCompare(b.key));
}
