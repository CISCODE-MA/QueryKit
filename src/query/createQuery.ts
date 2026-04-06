import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

export type QueryKeyFn<TParams> = (params: TParams) => readonly unknown[];
export type QueryFetcher<TParams, TData> = (params: TParams) => Promise<TData>;

type UseQueryShorthandOptions<TData> = Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>;

export interface QueryDefinition<TParams, TData> {
  queryKey: QueryKeyFn<TParams>;
  queryFn: QueryFetcher<TParams, TData>;
  useQuery: (
    params: TParams,
    options?: UseQueryShorthandOptions<TData>,
  ) => UseQueryResult<TData, Error>;
}

export function createQuery<TParams, TData>(
  keyFn: QueryKeyFn<TParams>,
  fetcher: QueryFetcher<TParams, TData>,
): QueryDefinition<TParams, TData> {
  return {
    queryKey: keyFn,
    queryFn: fetcher,
    useQuery(params, options) {
       
      return useTanstackQuery<TData, Error>({
        queryKey: keyFn(params),
        queryFn: () => fetcher(params),
        ...options,
      });
    },
  };
}
