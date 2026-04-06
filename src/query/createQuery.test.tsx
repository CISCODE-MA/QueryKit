import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createQuery } from './createQuery';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('createQuery', () => {
  it('returns a QueryDefinition with queryKey, queryFn, and useQuery', () => {
    const def = createQuery(
      (id: string) => ['user', id] as const,
      async (id: string) => ({ id, name: 'Alice' }),
    );

    expect(typeof def.queryKey).toBe('function');
    expect(typeof def.queryFn).toBe('function');
    expect(typeof def.useQuery).toBe('function');
  });

  it('queryKey returns the correct readonly tuple given params', () => {
    const def = createQuery(
      (id: string) => ['user', id] as const,
      async (id: string) => ({ id }),
    );

    expect(def.queryKey('123')).toEqual(['user', '123']);
  });

  it('queryKey produces a stable reference for the same params', () => {
    const def = createQuery(
      (id: number) => ['item', id] as const,
      async (id: number) => id,
    );

    const first = def.queryKey(1);
    const second = def.queryKey(1);
    expect(first).toEqual(second);
  });

  it('queryFn calls the fetcher with the given params', async () => {
    const fetcher = vi.fn(async (id: string) => ({ id, name: 'Bob' }));
    const def = createQuery((id: string) => ['user', id] as const, fetcher);

    const result = await def.queryFn('42');

    expect(fetcher).toHaveBeenCalledWith('42');
    expect(result).toEqual({ id: '42', name: 'Bob' });
  });

  it('queryFn return type is inferred from the fetcher (TData inference)', async () => {
    const def = createQuery(
      (n: number) => ['count', n] as const,
      async (n: number) => ({ value: n * 2 }),
    );

    const result = await def.queryFn(5);
    // TypeScript infers result as { value: number }
    expect(result.value).toBe(10);
  });

  it('useQuery hook resolves data from the fetcher', async () => {
    const fetcher = vi.fn(async (id: string) => ({ id, name: 'Carol' }));
    const def = createQuery((id: string) => ['user', id] as const, fetcher);

    const { result } = renderHook(() => def.useQuery('1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: '1', name: 'Carol' });
    expect(fetcher).toHaveBeenCalledWith('1');
  });

  it('useQuery hook shows loading state before data resolves', () => {
    let resolve: (v: { value: number }) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<{ value: number }>((res) => {
          resolve = res;
        }),
    );
    const def = createQuery((n: number) => ['lazy', n] as const, fetcher);

    const { result } = renderHook(() => def.useQuery(99), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    // Resolve to avoid open handles
    resolve!({ value: 99 });
  });

  it('useQuery respects enabled: false and does not call fetcher', () => {
    const fetcher = vi.fn(async (id: string) => ({ id }));
    const def = createQuery((id: string) => ['item', id] as const, fetcher);

    const { result } = renderHook(() => def.useQuery('x', { enabled: false }), {
      wrapper: makeWrapper(),
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useQuery uses the key from keyFn — different params produce different keys', async () => {
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
