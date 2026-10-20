import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { DomainError, DomainErrorCode } from '../shared-kernel';

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
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
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response
      .status(status)
      .type('application/problem+json')
      .json({ type: 'about:blank', title, status, detail });
  }
}
