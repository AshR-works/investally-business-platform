import { Controller, Get, Param, ParseEnumPipe, Query, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { ADMIN_EXPORT_KINDS, AdminExportKind, ExportAdminDataHandler } from '../application/admin/admin-exports';
import type { AccessContext } from '../application/access-types';
import type { AuthenticatedActor } from '../application/authenticate-access-token.use-case';
import { CurrentActor } from './access-token.guard';
import { AdminExportQueryDto } from './dto/admin.dto';
import { Access, Protected } from './protected.decorator';

/**
 * Exports d'administration pour les audits (`/admin/exports/{users|rights|sessions}`), en CSV. Super administrateur seulement (permission en portée Tous), second
 * facteur récent exigé, chaque export tracé dans l'audit avant remise, aucun secret dans le fichier. Jamais mis en cache.
 */
@ApiTags('admin')
@Controller('admin/exports')
export class AdminExportsController {
  constructor(private readonly exporter: ExportAdminDataHandler) {}

  @Get(':kind')
  @ApiOperation({ summary: 'Télécharger un export d\u2019administration (CSV)', description: 'Utilisateurs, droits ou sessions, pour les audits. Super administrateur seulement ; second facteur récent exigé ; l\u2019export est tracé dans l\u2019audit ; aucun secret dans le fichier.' })
  @ApiParam({ name: 'kind', enum: ADMIN_EXPORT_KINDS, description: 'Nature de l\u2019export' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'Fichier CSV (UTF-8 avec marque d\u2019ordre des octets, séparateur « ; »), remis en téléchargement', content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } } })
  @Protected('iam.export.read', { stepUp: true, minScope: 'ALL' })
  async download(
    @Param('kind', new ParseEnumPipe(ADMIN_EXPORT_KINDS)) kind: AdminExportKind,
    @Query() query: AdminExportQueryDto,
    @Access() access: AccessContext,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.exporter.execute({ kind, days: query.days, access, actor: actorContextFrom(req, actor) });
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.send(result.csv);
  }
}
