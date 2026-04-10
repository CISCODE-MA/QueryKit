import React from 'react';
import {
  useQuery as useTanstackQuery,
  useInfiniteQuery as useTanstackInfiniteQuery,
} from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { QueryDefinition } from './createQuery';

// ---------------------------------------------------------------------------
// Shared result fields
// ---------------------------------------------------------------------------

interface PaginatedBase<TData> {
  data: TData[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Offset mode
// ---------------------------------------------------------------------------

export interface OffsetPaginationOptions {
  mode: 'offset';
  pageSize?: number;
  initialPage?: number;
}

export interface OffsetPaginatedResult<TData> extends PaginatedBase<TData> {
  mode: 'offset';
  page: number;
  pageSize: number;
  totalPages: number | undefined;
  nextPage: () => void;
  prevPage: () => void;
}

// ---------------------------------------------------------------------------
// Cursor mode
// ---------------------------------------------------------------------------

export interface CursorPaginationOptions<TData> {
  mode: 'cursor';
  getCursor: (lastPage: TData[]) => string | number | null | undefined;
}

export interface CursorPaginatedResult<TData> extends PaginatedBase<TData> {
  mode: 'cursor';
  fetchNextPage: () => void;
  hasNextPage: boolean;
  nextCursor: string | number | null | undefined;
}

// ---------------------------------------------------------------------------
// Overloads
// ---------------------------------------------------------------------------

export function usePaginatedQuery<TParams, TData>(
  queryDef: QueryDefinition<TParams, TData[]>,
  params: TParams,
  options: OffsetPaginationOptions,
): OffsetPaginatedResult<TData>;

export function usePaginatedQuery<TParams, TData>(
  queryDef: QueryDefinition<TParams, TData[]>,
  params: TParams,
  options: CursorPaginationOptions<TData>,
): CursorPaginatedResult<TData>;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function usePaginatedQuery<TParams, TData>(
  queryDef: QueryDefinition<TParams, TData[]>,
  params: TParams,
  options: OffsetPaginationOptions | CursorPaginationOptions<TData>,
): OffsetPaginatedResult<TData> | CursorPaginatedResult<TData> {
  const isOffset = options.mode === 'offset';

  // --- Offset state (only meaningful in offset mode) -----------------------
  const pageSize = isOffset ? ((options as OffsetPaginationOptions).pageSize ?? 20) : 20;
  const [page, setPage] = React.useState(
    isOffset ? ((options as OffsetPaginationOptions).initialPage ?? 1) : 1,
  );

  // --- Offset: useQuery ----------------------------------------------------
  const offsetQuery = useTanstackQuery<TData[], Error>({
    queryKey: [...queryDef.queryKey({ ...params, page, pageSize } as TParams), page, pageSize],
    queryFn: () => queryDef.queryFn({ ...params, page, pageSize } as TParams),
    enabled: isOffset,
    placeholderData: (prev) => prev,
  });

  // --- Cursor: useInfiniteQuery --------------------------------------------
  const getCursor = !isOffset
    ? (options as CursorPaginationOptions<TData>).getCursor
    : () => undefined;

  const infiniteQuery = useTanstackInfiniteQuery<
    TData[],
    Error,
    InfiniteData<TData[]>,
    readonly unknown[],
    string | number | null | undefined
  >({
    queryKey: queryDef.queryKey(params),
    queryFn: ({ pageParam }) => queryDef.queryFn({ ...params, cursor: pageParam } as TParams),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => getCursor(lastPage) ?? undefined,
    enabled: !isOffset,
  });

  // --- Offset result -------------------------------------------------------
  if (isOffset) {
    const rawData = offsetQuery.data ?? [];
    return {
      mode: 'offset',
      data: rawData,
      isLoading: offsetQuery.isLoading,
      isFetching: offsetQuery.isFetching,
      isError: offsetQuery.isError,
      error: offsetQuery.error,
      page,
      pageSize,
      totalPages: undefined,
      nextPage: () => setPage((p) => p + 1),
      prevPage: () => setPage((p) => Math.max(1, p - 1)),
    };
  }

  // --- Cursor result -------------------------------------------------------
  const pages = infiniteQuery.data?.pages ?? [];
  const flatData = pages.flat();
  const lastPage = pages[pages.length - 1] ?? [];
  const nextCursor = getCursor(lastPage);

  return {
    mode: 'cursor',
    data: flatData,
    isLoading: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
    fetchNextPage: () => infiniteQuery.fetchNextPage(),
    hasNextPage: infiniteQuery.hasNextPage,
    nextCursor,
  };
}
