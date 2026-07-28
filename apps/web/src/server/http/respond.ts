/**
 * The imperative shell's edge: parse → use-case → Response.
 *
 * Route handlers stay ~15 lines: they zod-parse input, invoke one use-case
 * returning ResultAsync<T, AppError>, and hand the Result here.
 */

import { NextResponse } from 'next/server';
import type { ResultAsync } from 'neverthrow';
import type { ZodType } from 'zod';
import { err, ok, type Result } from 'neverthrow';
import { logger } from '@/lib/logger';
import { toHttp, validation, type AppError } from './errors';

/** Parse unknown input against a contract schema into a typed Result. */
export function parse<T>(schema: ZodType<T>, input: unknown): Result<T, AppError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err(
    validation(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    )
  );
}

interface RespondOptions {
  /** Success status (default 200) */
  status?: number;
  /** Cache-Control header for successful responses */
  cacheControl?: string;
}

/** Materialize a use-case Result into a JSON Response. */
export async function respond<T>(
  result: ResultAsync<T, AppError> | Promise<Result<T, AppError>>,
  options: RespondOptions = {}
): Promise<NextResponse> {
  const settled = await result;
  return settled.match(
    (value) =>
      NextResponse.json(value as unknown as Record<string, unknown>, {
        status: options.status ?? 200,
        ...(options.cacheControl
          ? { headers: { 'Cache-Control': options.cacheControl } }
          : {}),
      }),
    (error) => {
      if (error.kind === 'DB' || error.kind === 'INTERNAL') {
        logger.error('use-case failure', { error });
      }
      const { status, body } = toHttp(error);
      return NextResponse.json(body, { status });
    }
  );
}
