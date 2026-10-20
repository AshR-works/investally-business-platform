import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client';
import { UnitOfWork } from '../shared-kernel';

/**
 * Accès unique à Prisma. Les repositories lisent `db` : c'est le client transactionnel
 * si une unité de travail est en cours, le client normal sinon.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy, UnitOfWork {
  private readonly client: PrismaClient;
  private readonly transaction = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL est obligatoire');
    }
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  get db(): Prisma.TransactionClient {
    return this.transaction.getStore() ?? this.client;
  }

  /** UnitOfWork : agrégat et audit sont écrits atomiquement. */
  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.transaction.getStore()) {
      return work();
    }
    return this.client.$transaction((tx) => this.transaction.run(tx, work), { timeout: 10_000 });
  }

  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
