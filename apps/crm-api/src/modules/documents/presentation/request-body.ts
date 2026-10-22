import { PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Lit le corps brut d'un envoi de fichier (`application/octet-stream`) en refusant, AVANT d'avoir tout reçu, un fichier
 * qui dépasse la taille maximale : l'en-tête `Content-Length` puis le cumul des octets reçus sont contrôlés. Un autre
 * type de contenu est refusé (415) : le type réel du fichier est reconnu plus tard par sa signature.
 */
export async function readBinaryBody(req: Request, maxBytes: number): Promise<Buffer> {
  if (!req.is('application/octet-stream')) throw new UnsupportedMediaTypeException('Envoyez le fichier en application/octet-stream');
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeException('Fichier trop volumineux');
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const piece = chunk as Buffer;
    total += piece.length;
    if (total > maxBytes) throw new PayloadTooLargeException('Fichier trop volumineux');
    chunks.push(piece);
  }
  return Buffer.concat(chunks, total);
}

/** En-tête `Content-Disposition` d'un téléchargement : toujours « attachment », nom ASCII de repli et nom UTF-8 exact. */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName.replace(/[^A-Za-z0-9._ -]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
