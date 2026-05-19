/**
 * Exit-code mapping for SDK errors.
 *
 * The SDK throws typed subclasses of `WebScrapingAIError`. Map each to a
 * stable exit code so shell scripts can branch on the failure mode without
 * parsing stderr.
 */

import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  AuthenticationError,
  BadRequestError,
  GatewayTimeoutError,
  PaymentRequiredError,
  RateLimitError,
  ServerError,
  WebScrapingAIError,
} from 'webscraping-ai';

export const EXIT_CODES = {
  ok: 0,
  generic: 1,
  usage: 2,
  badRequest: 3,
  auth: 4,
  paymentRequired: 5,
  rateLimit: 6,
  serverError: 7,
  timeout: 8,
  connection: 9,
} as const;

export function exitCodeFor(err: unknown): number {
  if (err instanceof BadRequestError) return EXIT_CODES.badRequest;
  if (err instanceof AuthenticationError) return EXIT_CODES.auth;
  if (err instanceof PaymentRequiredError) return EXIT_CODES.paymentRequired;
  if (err instanceof RateLimitError) return EXIT_CODES.rateLimit;
  if (err instanceof ServerError) return EXIT_CODES.serverError;
  if (err instanceof GatewayTimeoutError) return EXIT_CODES.timeout;
  if (err instanceof APITimeoutError) return EXIT_CODES.timeout;
  if (err instanceof APIConnectionError) return EXIT_CODES.connection;
  if (err instanceof APIError) return EXIT_CODES.serverError;
  if (err instanceof WebScrapingAIError) return EXIT_CODES.generic;
  return EXIT_CODES.generic;
}

export function formatError(err: unknown): string {
  if (err instanceof APIError) {
    const parts = [err.message];
    if (err.status) parts.push(`(HTTP ${err.status})`);
    return parts.join(' ');
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
