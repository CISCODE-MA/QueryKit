/**
 * COMPT-43 — usePaginatedQuery integration tests
 * Runs in src/__tests__/ (separate from co-located unit tests).
 * Uses a fresh QueryClient per test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createQuery } from '../query/createQuery';
import { usePaginatedQuery } from '../query/usePaginatedQuery';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Item {
  id: number;
  label: string;
}

function makeItems(count: number, offset = 0): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: offset + i + 1,
    label: `item-${offset + i + 1}`,
  }));
}

const offsetFetcher = vi.fn(
  async (p: { page: number; pageSize: number }): Promise<Item[]> =>
    makeItems(p.pageSize, (p.page - 1) * p.pageSize),
);

const cursorFetcher = vi.fn(
  async (p: { cursor?: number | string | null | undefined }): Promise<Item[]> => {
    const start = p.cursor ? Number(p.cursor) : 0;
    return makeItems(3, start);
  },
);

const offsetQueryDef = createQuery(
  (p: { page: number; pageSize: number }) => ['items', 'offset', p.page, p.pageSize] as const,
  offsetFetcher,
);

const cursorQueryDef = createQuery(
  (p: { cursor?: number | string | null | undefined }) => ['items', 'cursor', p.cursor] as const,
  cursorFetcher,
);

// ---------------------------------------------------------------------------
// Offset mode
// ---------------------------------------------------------------------------

describe('usePaginatedQuery — offset mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('data is a flat array on first page', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          offsetQueryDef,
          { page: 1, pageSize: 3 },
          { mode: 'offset', pageSize: 3 },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(3);
  });

  it('starts at page 1 by default', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          offsetQueryDef,
          { page: 1, pageSize: 3 },
          { mode: 'offset', pageSize: 3 },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.page).toBe(1);
  });

  it('nextPage increments page and data updates', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          offsetQueryDef,
          { page: 1, pageSize: 3 },
          { mode: 'offset', pageSize: 3 },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.nextPage());

    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data[0].id).toBe(4);
  });

  it('prevPage decrements page', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          offsetQueryDef,
          { page: 2, pageSize: 3 },
          { mode: 'offset', pageSize: 3, initialPage: 2 },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.prevPage());

    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it('prevPage does not go below page 1', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          offsetQueryDef,
          { page: 1, pageSize: 3 },
          { mode: 'offset', pageSize: 3 },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.prevPage());
    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it('exposes isLoading, isError, error', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          offsetQueryDef,
          { page: 1, pageSize: 3 },
          { mode: 'offset', pageSize: 3 },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('pageSize defaults to 20', () => {
    const { result } = renderHook(
      () => usePaginatedQuery(offsetQueryDef, { page: 1, pageSize: 20 }, { mode: 'offset' }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.pageSize).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Cursor mode
// ---------------------------------------------------------------------------

describe('usePaginatedQuery — cursor mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('data is a flat array of first page', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          cursorQueryDef,
          { cursor: undefined },
          {
            mode: 'cursor',
            getCursor: (page) => (page.length > 0 ? page[page.length - 1].id : undefined),
          },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(3);
  });

  it('fetchNextPage appends data — flat array grows', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          cursorQueryDef,
          { cursor: undefined },
          {
            mode: 'cursor',
            getCursor: (page) => (page.length > 0 ? page[page.length - 1].id : undefined),
          },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(3);

    await act(async () => {
      result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(6));
    expect(result.current.data[3].id).toBe(4);
  });

  it('hasNextPage is true when getCursor returns a value', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          cursorQueryDef,
          { cursor: undefined },
          {
            mode: 'cursor',
            getCursor: (page) => (page.length > 0 ? page[page.length - 1].id : undefined),
          },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('hasNextPage is false when getCursor returns undefined', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          cursorQueryDef,
          { cursor: undefined },
          {
            mode: 'cursor',
            getCursor: () => undefined,
          },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('nextCursor reflects last item cursor', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery(
          cursorQueryDef,
          { cursor: undefined },
          {
            mode: 'cursor',
            getCursor: (page) => (page.length > 0 ? page[page.length - 1].id : undefined),
          },
        ),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nextCursor).toBe(3);
  });
});
