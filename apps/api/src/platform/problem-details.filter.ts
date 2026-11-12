import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { DomainError, DomainErrorCode } from '../shared-kernel';

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  MFA_REQUIRED: 403,
  MFA_STEP_UP_REQUIRED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVARIANT_VIOLATION: 422,
};

/** Traduit les erreurs en RFC 7807 (application/problem+json). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = 500;
    let title = 'Erreur interne';
    let detail: unknown = undefined;

    if (exception instanceof DomainError) {
      status = STATUS_BY_CODE[exception.code];
      title = exception.code;
      detail = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = exception.name;
      detail = exception.getResponse();
    } else {
      this.logger.error(describeForLog(exception));
    }

    response
      .status(status)
      .type('application/problem+json')
      .json({ type: 'about:blank', title, status, detail });
  }
}

/**
 * Ce qu'on écrit dans les journaux pour une erreur inattendue. Les erreurs Prisma embarquent la requête et ses
 * VALEURS (par exemple un hachage de mot de passe) dans leur message : on n'en garde que le nom et le code.
 */
export function describeForLog(exception: unknown): string {
  if (exception instanceof Error) {
    if (exception.name.startsWith('PrismaClient')) {
      const code = (exception as { code?: unknown }).code;
      return `${exception.name}${typeof code === 'string' ? ` (${code})` : ''} — détails omis volontairement`;
    }
    return exception.stack ?? `${exception.name}: ${exception.message}`;
  }
  return 'Erreur non standard';
}
