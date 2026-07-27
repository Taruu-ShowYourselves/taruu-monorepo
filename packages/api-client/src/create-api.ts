/**
 * Functional, contract-validated API client.
 *
 * `createApi` replaces the mutable ApiClient singleton: no shared state,
 * every response zod-parsed against @sync/shared/contracts before it
 * reaches application code, every call returns ResultAsync instead of
 * throwing. Web client components and the Expo app share this; web RSC
 * never imports it (server components call use-cases directly).
 */

import { ResultAsync } from 'neverthrow';
import type { ZodType } from 'zod';
import {
  GetVotesResponseSchema,
  CreateVoteResponseSchema,
  MunicipalityProfileResponseSchema,
  DashboardResponseSchema,
  type GetVotesResponse,
  type CreateVoteResponse,
  type CreateVoteRequest,
  type MunicipalityProfileResponse,
  type DashboardResponse,
} from '@sync/shared/contracts';

export type ApiFailure =
  | { kind: 'network'; cause: string }
  | { kind: 'http'; status: number; code?: string; message: string }
  | { kind: 'contract'; issues: string[] };

export interface CreateApiConfig {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
  fetchFn?: typeof fetch;
}

type Query = Record<string, string | number | undefined>;

function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function request<T>(
  config: CreateApiConfig,
  schema: ZodType<T>,
  path: string,
  init: { method: string; body?: unknown; query?: Query }
): ResultAsync<T, ApiFailure> {
  const doFetch = async (): Promise<T> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await config.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await (config.fetchFn ?? fetch)(
      buildUrl(config.baseUrl, path, init.query),
      {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      throw {
        kind: 'http',
        status: response.status,
        code: body.code,
        message: body.error ?? 'Request failed',
      } satisfies ApiFailure;
    }

    const json = await response.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw {
        kind: 'contract',
        issues: parsed.error.issues.map(
          (i) => `${i.path.join('.') || '(root)'}: ${i.message}`
        ),
      } satisfies ApiFailure;
    }
    return parsed.data;
  };

  return ResultAsync.fromPromise(doFetch(), (cause): ApiFailure => {
    if (
      typeof cause === 'object' &&
      cause !== null &&
      'kind' in cause &&
      (cause.kind === 'http' || cause.kind === 'contract')
    ) {
      return cause as ApiFailure;
    }
    return {
      kind: 'network',
      cause: cause instanceof Error ? cause.message : String(cause),
    };
  });
}

export function createApi(config: CreateApiConfig) {
  return {
    votes: {
      list: (query?: {
        municipality?: string;
        status?: 'pending' | 'active' | 'ended';
      }): ResultAsync<GetVotesResponse, ApiFailure> =>
        request(config, GetVotesResponseSchema, '/api/votes', {
          method: 'GET',
          query,
        }),
      create: (
        body: Omit<CreateVoteRequest, 'municipality'>
      ): ResultAsync<CreateVoteResponse, ApiFailure> =>
        request(config, CreateVoteResponseSchema, '/api/votes', {
          method: 'POST',
          body,
        }),
    },
    municipalities: {
      profile: (
        municipality: string
      ): ResultAsync<MunicipalityProfileResponse, ApiFailure> =>
        request(
          config,
          MunicipalityProfileResponseSchema,
          `/api/municipalities/${encodeURIComponent(municipality)}`,
          { method: 'GET' }
        ),
    },
    dashboard: {
      get: (): ResultAsync<DashboardResponse, ApiFailure> =>
        request(config, DashboardResponseSchema, '/api/dashboard', {
          method: 'GET',
        }),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
