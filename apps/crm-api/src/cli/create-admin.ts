import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CreateUserUseCase } from '../modules/iam/application/create-user.use-case';
import { RoleCode } from '../modules/iam/domain/roles';
import { seedCore } from '../modules/iam/infrastructure/seed-core';
import { PrismaService } from '../platform/prisma.service';
import { UuidV7Generator } from '../platform/uuid-v7-generator';
import { askHidden, parseAdminArgs } from './create-admin.logic';

/**
 * Crée un compte SuperAdmin (le premier, puis le second : il en faut au moins deux, sans compte partagé).
 *   pnpm crm-api build
 *   pnpm crm-api admin:create -- --email prenom.nom@exemple.test --name "Prénom Nom"
 * Mot de passe : saisie masquée, ou variable BOOTSTRAP_ADMIN_PASSWORD (automatisation). Aucun mot de passe par défaut,
 * jamais affiché ni stocké en clair. Au premier accès, le MFA est obligatoire : l'administrateur enrôle son application.
 */
async function main() {
  const { email, name } = parseAdminArgs(process.argv.slice(2));
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? (await askHidden('Mot de passe (12 caractères minimum, saisie masquée) : '));
  if (!process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    const again = await askHidden('Confirmez le mot de passe : ');
    if (again !== password) throw new Error('Les deux saisies ne correspondent pas');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    // Garantit l'existence des rôles (idempotent) : la création échouerait sinon.
    await seedCore(app.get(PrismaService), new UuidV7Generator());
    const created = await app.get(CreateUserUseCase).execute({
      email,
      displayName: name,
      password,
      roles: [RoleCode.SuperAdmin],
      actor: { userId: null, sessionId: null, ipAddress: 'cli', device: 'cli:admin:create' },
    });
    console.log(`SuperAdmin créé : ${created.email} (identifiant ${created.id}).`);
    console.log('À la première connexion, il devra enrôler son application d\'authentification (MFA obligatoire).');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  // Message seulement : jamais de trace qui pourrait contenir des valeurs de requête.
  console.error(`Échec : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
  process.exitCode = 1;
});
