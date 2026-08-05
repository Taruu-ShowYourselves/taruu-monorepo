/**
 * User repository - Result-typed reads over the users table.
 * Delegates to the legacy db.ts helpers where they are already sound,
 * converting their null/throw conventions into explicit Results.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { getUserById as dbGetUserById } from '@/lib/supabase/db';
import type { User } from '@/lib/supabase/types';
import { dbError, notFound, type AppError } from '@/server/http/errors';

export function findUserById(userId: string): ResultAsync<User, AppError> {
  return ResultAsync.fromPromise(dbGetUserById(userId), (cause) =>
    dbError('users.findById', cause)
  ).andThen((user) =>
    user ? okAsync<User, AppError>(user) : errAsync<User, AppError>(notFound('Profile'))
  );
}
