import 'reflect-metadata';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CreateUserUseCase } from '../modules/iam/application/create-user.use-case';
import { seedCore } from '../modules/iam/infrastructure/seed-core';
import { PrismaService } from '../platform/prisma.service';
import { UuidV7Generator } from '../platform/uuid-v7-generator';
import { assertNotProduction, DEMO_USERS, generateDemoPassword } from './demo-users.logic';

interface Entry { email: string; role: string; password: string }

/**
 * Crée un compte de démonstration par rôle (développement et recette SEULEMENT).
 *   DEMO_ACCOUNTS_FILE=<fichier.json> node dist/src/cli/create-demo-users.js
 * Idempotent : un compte déjà présent est laissé tel quel. Chaque mot de passe est aléatoire et n'est écrit que dans le
 * fichier indiqué (droits restreints), jamais dans le dépôt ni dans l'audit. Le MFA reste obligatoire à la première connexion.
 */
async function main() {
  assertNotProduction();
  const file = process.env.DEMO_ACCOUNTS_FILE;
  if (!file) throw new Error('DEMO_ACCOUNTS_FILE est obligatoire (fichier de sortie des mots de passe)');
  const entries: Entry[] = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Entry[]) : [];

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const prisma = app.get(PrismaService);
    await seedCore(prisma, new UuidV7Generator());
    const create = app.get(CreateUserUseCase);
    const ids = new Map<string, string>();
    let created = 0;
    for (const demo of DEMO_USERS) {
      const existing = await prisma.db.user.findFirst({ where: { emailKey: demo.email.toLowerCase(), deletedAt: null }, select: { id: true } });
      if (existing) { ids.set(demo.email, existing.id); continue; }
      const password = generateDemoPassword();
      const user = await create.execute({
        email: demo.email,
        displayName: demo.name,
        password,
        roles: [demo.role],
        managerId: demo.managerEmail ? ids.get(demo.managerEmail) ?? null : null,
        actor: { userId: null, sessionId: null, ipAddress: 'cli', device: 'cli:demo:users' },
      });
      ids.set(demo.email, user.id);
      entries.push({ email: demo.email, role: demo.role, password });
      created++;
    }
    writeFileSync(file, JSON.stringify(entries, null, 2), { mode: 0o600 });
    try { chmodSync(file, 0o600); } catch { /* droits POSIX sans effet sous Windows */ }
    console.log(`Comptes de démonstration : ${created} créé(s), ${DEMO_USERS.length - created} déjà présent(s).`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Échec : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
  process.exitCode = 1;
});
