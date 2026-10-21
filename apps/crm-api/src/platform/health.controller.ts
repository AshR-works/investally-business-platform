import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Sondes de santé : `live` (le processus répond) et `ready` (la base répond). */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Le processus répond. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Vérifie la base de données ; 503 si elle ne répond pas. */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.ping();
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'down' });
    }
  }
}
