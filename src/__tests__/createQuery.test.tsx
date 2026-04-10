/**
 * COMPT-43 — createQuery integration tests
 * Runs in src/__tests__/ (separate from co-located unit tests).
 * Uses a fresh QueryClient per test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createQuery } from '../query/createQuery';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface User {
  id: number;
  name: string;
}

const userFetcher = vi.fn(
  async (p: { id: number }): Promise<User> => ({
    id: p.id,
    name: `User ${p.id}`,
  }),
);

const userQueryDef = createQuery((p: { id: number }) => ['user', p.id] as const, userFetcher);

const tagsFetcher = vi.fn(async (): Promise<string[]> => ['react', 'typescript']);

const tagsQueryDef = createQuery(() => ['tags'] as const, tagsFetcher);

describe('createQuery — queryKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds correct key for static (param-less) query', () => {
    expect(tagsQueryDef.queryKey({} as never)).toEqual(['tags']);
  });

  it('builds correct key for dynamic params', () => {
    expect(userQueryDef.queryKey({ id: 42 })).toEqual(['user', 42]);
  });

  it('builds different keys for different params', () => {
    const k1 = userQueryDef.queryKey({ id: 1 });
    const k2 = userQueryDef.queryKey({ id: 2 });
    expect(k1).not.toEqual(k2);
  });

  it('key is a readonly tuple', () => {
    const key = userQueryDef.queryKey({ id: 7 });
    expect(Array.isArray(key)).toBe(true);
  });
});

describe('createQuery — queryFn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the fetcher with the given params', async () => {
    await userQueryDef.queryFn({ id: 5 });
    expect(userFetcher).toHaveBeenCalledWith({ id: 5 });
  });

  it('returns data from the fetcher', async () => {
    const result = await userQueryDef.queryFn({ id: 3 });
    expect(result).toEqual({ id: 3, name: 'User 3' });
  });
});

describe('createQuery — useQuery shorthand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts in loading state', () => {
    const { result } = renderHook(() => userQueryDef.useQuery({ id: 1 }), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('transitions to success state with correct data', async () => {
    const { result } = renderHook(() => userQueryDef.useQuery({ id: 10 }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 10, name: 'User 10' });
  });

  it('transitions to error state when fetcher throws', async () => {
    const failFetcher = vi.fn(async (): Promise<User> => {
      throw new Error('fetch failed');
    });
    const failDef = createQuery(() => ['fail'] as const, failFetcher);

    const { result } = renderHook(() => failDef.useQuery({} as never), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('fetch failed');
  });

  it('does not fetch when enabled is false', async () => {
    renderHook(() => userQueryDef.useQuery({ id: 99 }, { enabled: false }), {
      wrapper: makeWrapper(),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(userFetcher).not.toHaveBeenCalledWith({ id: 99 });
  });

  it('re-fetches when params change', async () => {
    let id = 1;
    const { result, rerender } = renderHook(() => userQueryDef.useQuery({ id }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(1);

    id = 2;
    rerender();

    await waitFor(() => expect(result.current.data?.id).toBe(2));
  });
});

// ---------------------------------------------------------------------------
// Definition shape (unit-level)
// ---------------------------------------------------------------------------

describe('createQuery — definition shape', () => {
  it('returns a QueryDefinition with queryKey, queryFn, and useQuery properties', () => {
    const def = createQuery(
      (id: string) => ['user', id] as const,
      async (id: string) => ({ id, name: 'Alice' }),
    );
    expect(typeof def.queryKey).toBe('function');
    expect(typeof def.queryFn).toBe('function');
    expect(typeof def.useQuery).toBe('function');
  });

  it('queryKey produces a stable value for the same params', () => {
    const def = createQuery(
      (id: number) => ['item', id] as const,
      async (id: number) => id,
    );
    expect(def.queryKey(1)).toEqual(def.queryKey(1));
  });

  it('queryFn return type is inferred from the fetcher (TData inference)', async () => {
    const def = createQuery(
      (n: number) => ['count', n] as const,
      async (n: number) => ({ value: n * 2 }),
    );
    const result = await def.queryFn(5);
    expect(result.value).toBe(10);
  });

  it('useQuery keys isolate data per param (different string params)', async () => {
    const fetcher = vi.fn(async (id: string) => ({ id }));
    const def = createQuery((id: string) => ['entity', id] as const, fetcher);
    const wrapper = makeWrapper();
    const { result: r1 } = renderHook(() => def.useQuery('a'), { wrapper });
    const { result: r2 } = renderHook(() => def.useQuery('b'), { wrapper });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(r1.current.data).toEqual({ id: 'a' });
    expect(r2.current.data).toEqual({ id: 'b' });
  });
});
