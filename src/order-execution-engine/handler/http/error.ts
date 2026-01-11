// HTTP Error Handler - Maps domain errors to HTTP responses
// Centralizes error handling logic for all HTTP handlers

import type { FastifyReply } from 'fastify';
import { Logger } from '@/common/logger';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  BadRequestError,
} from '@/common/errors/errors';

// Map domain errors to HTTP responses
export function handleHttpError(error: unknown, reply: FastifyReply): void {
  if (error instanceof ValidationError) {
    reply.code(400).send({
      success: false,
      error: 'Validation failed',
      message: error.message,
    });
  } else if (error instanceof BadRequestError) {
    reply.code(400).send({
      success: false,
      error: 'Bad request',
      message: error.message,
    });
  } else if (error instanceof NotFoundError) {
    reply.code(404).send({
      success: false,
      error: 'Not found',
      message: error.message,
    });
  } else if (error instanceof ConflictError) {
    reply.code(409).send({
      success: false,
      error: 'Conflict',
      message: error.message,
    });
  } else if (error instanceof ServiceUnavailableError) {
    reply.code(503).send({
      success: false,
      error: 'Service unavailable',
      message: error.message,
    });
  } else {
    // Unknown error - log details and return generic message
    Logger.getInstance().error('Unexpected error in HTTP handler', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    reply.code(500).send({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
