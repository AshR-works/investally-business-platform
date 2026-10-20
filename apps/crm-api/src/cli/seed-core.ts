import 'reflect-metadata';
import { seedCore } from '../modules/iam/infrastructure/seed-core';
import { PrismaService } from '../platform/prisma.service';
import { UuidV7Generator } from '../platform/uuid-v7-generator';

/** `pnpm crm-api seed:core` — synchronise rôles et permissions (idempotent, sans utilisateur). */
async function main() {
  const prisma = new PrismaService();
  try {
    const report = await seedCore(prisma, new UuidV7Generator());
    console.log('Seed Core terminé :', JSON.stringify(report));
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
