import {
  Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  AddDocumentVersionUseCase, ArchiveDocumentUseCase, DownloadDocumentUseCase, GetDocumentHandler, ListDocumentsHandler, UploadDocumentUseCase,
} from '../application/document-use-cases';
import { MAX_UPLOAD_BYTES, uploadRules } from '../application/upload-rules';
import { DownloadQueryDto, ListDocumentsQueryDto, NewVersionQueryDto, UploadDocumentQueryDto } from './dto/documents.dto';
import { attachmentHeader, readBinaryBody } from './request-body';

/** Les réponses documentaires ne doivent jamais être mises en cache (données de l'entreprise). */
function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
}

/**
 * Routes des documents (S3.6). Chaque route est protégée (identité + MFA + permission `docs.document.*`), puis le cas
 * d'usage exige l'accès à l'objet propriétaire : un document n'est jamais plus accessible que son dossier, et tout refus
 * est « introuvable ». Le fichier est le CORPS de la requête (`application/octet-stream`), jamais un champ de formulaire.
 */
@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly upload: UploadDocumentUseCase,
    private readonly addVersion: AddDocumentVersionUseCase,
    private readonly list: ListDocumentsHandler,
    private readonly get: GetDocumentHandler,
    private readonly download: DownloadDocumentUseCase,
    private readonly archive: ArchiveDocumentUseCase,
  ) {}

  /** Règles d'envoi (formats, taille maximale, catégories) pour que l'interface les affiche sans les dupliquer. */
  @Get('meta')
  @Protected('docs.document.read')
  meta(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return uploadRules();
  }

  /** Envoie un nouveau document (version 1) sur un objet propriétaire. */
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Protected('docs.document.create')
  async create(@Query() query: UploadDocumentQueryDto, @Req() req: Request, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor) {
    const bytes = await readBinaryBody(req, MAX_UPLOAD_BYTES);
    return this.upload.execute({ ...query, bytes, access, actor: actorContextFrom(req, actor) });
  }

  /** Documents d'un objet propriétaire visibles de l'appelant. */
  @Get()
  @Protected('docs.document.read')
  async listByOwner(@Query() query: ListDocumentsQueryDto, @Access() access: AccessContext, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.list.execute({ ownerType: query.ownerType, ownerId: query.ownerId, includeArchived: query.includeArchived ?? false, access });
  }

  /** Détail d'un document et de toutes ses versions. */
  @Get(':id')
  @Protected('docs.document.read')
  async detail(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.get.execute({ id, access });
  }

  /** Ajoute une version à un document (les précédentes restent intactes). */
  @Post(':id/versions')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Protected('docs.document.create')
  async newVersion(@Param('id', ParseUUIDPipe) id: string, @Query() query: NewVersionQueryDto, @Req() req: Request, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor) {
    const bytes = await readBinaryBody(req, MAX_UPLOAD_BYTES);
    return this.addVersion.execute({ documentId: id, fileName: query.fileName, bytes, access, actor: actorContextFrom(req, actor) });
  }

  /** Télécharge une version en pièce jointe, après vérification de son empreinte SHA-256 ; chaque téléchargement est audité. */
  @Get(':id/download')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Protected('docs.document.download')
  async downloadVersion(
    @Param('id', ParseUUIDPipe) id: string, @Query() query: DownloadQueryDto, @Req() req: Request,
    @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.download.execute({ id, versionNumber: query.version, access, actor: actorContextFrom(req, actor) });
    noStore(res);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', attachmentHeader(file.fileName));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Jamais rendu comme une page : même si un navigateur ouvrait le fichier, rien ne s'exécute.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Document-Sha256', file.sha256);
    res.setHeader('X-Document-Scan-Status', file.scanStatus);
    return new StreamableFile(file.bytes);
  }

  /** Archive un document (suppression logique : versions et fichiers conservés). */
  @Post(':id/archive')
  @HttpCode(204)
  @Protected('docs.document.delete')
  async archiveDocument(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor): Promise<void> {
    await this.archive.execute({ id, access, actor: actorContextFrom(req, actor) });
  }
}
