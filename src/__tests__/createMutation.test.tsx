/**
 * COMPT-43 — createMutation integration tests
 * Runs in src/__tests__/ (separate from co-located unit tests).
 * Uses a fresh QueryClient per test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createMutation } from '../query/createMutation';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface CreateItemInput {
  name: string;
}

interface Item {
  id: number;
  name: string;
}

const successFetcher = vi.fn(
  async (input: CreateItemInput): Promise<Item> => ({
    id: 1,
    name: input.name,
  }),
);

const failFetcher = vi.fn(async (): Promise<Item> => {
  throw new Error('mutation failed');
});

const createItemMutation = createMutation(successFetcher);
const failMutation = createMutation(failFetcher);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createMutation — useMutation shorthand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts in idle state (not pending, no data, no error)', () => {
    const { result } = renderHook(() => createItemMutation.useMutation(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('mutate fires the fetcher with provided variables', async () => {
    const { result } = renderHook(() => createItemMutation.useMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ name: 'hello' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // TanStack Query v5 calls mutationFn(variables, context) — check only variables
    expect(successFetcher.mock.calls[0][0]).toEqual({ name: 'hello' });
  });

  it('populates data on success', async () => {
    const { result } = renderHook(() => createItemMutation.useMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ name: 'world' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ id: 1, name: 'world' });
  });

  it('isPending is true while mutation is in flight', async () => {
    let resolve!: (v: Item) => void;
    const slowFetcher = vi.fn(
      (): Promise<Item> =>
        new Promise((res) => {
          resolve = res;
        }),
    );
    const slowMutation = createMutation(slowFetcher);

    const { result } = renderHook(() => slowMutation.useMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ name: 'slow' });
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => resolve({ id: 99, name: 'slow' }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('sets isError and error when fetcher throws', async () => {
    const { result } = renderHook(() => failMutation.useMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({} as never);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('mutation failed');
  });

  it('reset clears error state back to idle', async () => {
    const { result } = renderHook(() => failMutation.useMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({} as never);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    act(() => result.current.reset());
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  it('reset clears success state back to idle', async () => {
    const { result } = renderHook(() => createItemMutation.useMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ name: 'to-reset' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => result.current.reset());
    await waitFor(() => expect(result.current.isSuccess).toBe(false));
    expect(result.current.data).toBeUndefined();
  });

  it('mutateAsync returns the result', async () => {
    const { result } = renderHook(() => createItemMutation.useMutation(), {
      wrapper: makeWrapper(),
    });

    let returned: Item | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ name: 'async-item' });
    });

    expect(returned).toEqual({ id: 1, name: 'async-item' });
  });

  it('mutateAsync rejects on failure', async () => {
    const { result } = renderHook(() => failMutation.useMutation(), {
      wrapper: makeWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({} as never);
      }),
    ).rejects.toThrow('mutation failed');
  });
});
