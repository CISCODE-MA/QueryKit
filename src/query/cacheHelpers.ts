import type { QueryClient } from '@tanstack/react-query';
import type { QueryDefinition } from './createQuery';

/**
 * Invalidates all queries matching a QueryDefinition's key.
 * Optionally scoped to specific params — never uses raw string keys.
 */
export function invalidateQueries<TParams, TData>(
  client: QueryClient,
  queryDef: QueryDefinition<TParams, TData>,
  params?: TParams,
): Promise<void> {
  const queryKey =
    params !== undefined ? queryDef.queryKey(params) : queryDef.queryKey({} as TParams);
  return client.invalidateQueries({ queryKey: queryKey as unknown[] });
}

/**
 * Typed cache setter — updater receives TData and must return TData.
 * Passing the wrong shape is a TypeScript compile error.
 */
export function setQueryData<TParams, TData>(
  client: QueryClient,
  queryDef: QueryDefinition<TParams, TData>,
  params: TParams,
  updater: TData | ((old: TData | undefined) => TData),
): void {
  client.setQueryData<TData>(queryDef.queryKey(params) as unknown[], updater);
}
