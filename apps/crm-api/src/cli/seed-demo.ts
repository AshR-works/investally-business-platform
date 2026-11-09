import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../platform/prisma.service';
import { assertLocalDatabase, assertNotProduction, DEMO_USERS } from './demo-users.logic';
import { runSeed } from './seed/run-seed';
import { buildPlan, Who } from './seed/seed-plan';

/** Compte de démonstration de chaque rôle du plan (créés avant par `create-demo-users`). */
const SEED_USERS: Record<Who, string> = {
  compte1: 'compte1@demo.investally.test',
  compte2: 'compte2@demo.investally.test',
  compte3: 'compte3@demo.investally.test',
  commercial: 'commercial@demo.investally.test',
  finance: 'finance@demo.investally.test',
  investudy: 'investudy@demo.investally.test',
  rh: 'rh@demo.investally.test',
};

/**
 * Charge le jeu de données de démonstration (développement et recette SEULEMENT) :
 *   node dist/src/cli/seed-demo.js
 * Quarante entreprises fictives et leur vie commerciale sur douze mois, rejouées à travers les vrais cas d'usage (mêmes règles que
 * l'interface). Idempotent : si le jeu est déjà chargé, rien n'est fait. Refuse la production et toute base qui n'est pas locale.
 * Prérequis : les comptes de démonstration (`create-demo-users`).
 */
async function main() {
  assertNotProduction();
  assertLocalDatabase();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const prisma = app.get(PrismaService);
    const users = {} as Record<Who, string>;
    for (const [who, email] of Object.entries(SEED_USERS) as [Who, string][]) {
      if (!DEMO_USERS.some((u) => u.email === email)) throw new Error(`Le compte ${email} n'est pas dans la liste des comptes de démonstration`);
      const user = await prisma.db.user.findFirst({ where: { emailKey: email.toLowerCase(), deletedAt: null }, select: { id: true } });
      if (!user) throw new Error(`Compte de démonstration introuvable : ${email}. Lancez d'abord « node dist/src/cli/create-demo-users.js ».`);
      users[who] = user.id;
    }
    const result = await runSeed(app, buildPlan({ anchor: new Date() }), { users, log: (line) => console.log(line) });
    if (!result.skipped) console.log(`Blocs chargés : ${result.loaded.join(', ')}.`);
    if (!result.skipped) console.log(`Détail : ${Object.entries(result.counts).map(([kind, n]) => `${kind} ${n}`).join(', ')}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Échec : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
  process.exitCode = 1;
});
