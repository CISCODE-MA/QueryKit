/**
 * COMPT-43 — cacheHelpers integration tests
 * Runs in src/__tests__/ (separate from co-located unit tests).
 * Uses a fresh QueryClient per test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createQuery } from '../query/createQuery';
import { invalidateQueries, setQueryData } from '../query/cacheHelpers';

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Post {
  id: number;
  title: string;
}

const postFetcher = vi.fn(
  async (p: { id: number }): Promise<Post> => ({
    id: p.id,
    title: `Post ${p.id}`,
  }),
);

const postsQueryDef = createQuery((p: { id: number }) => ['posts', p.id] as const, postFetcher);

// ---------------------------------------------------------------------------
// invalidateQueries
// ---------------------------------------------------------------------------

describe('cacheHelpers — invalidateQueries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks the cached query as stale (isInvalidated: true)', async () => {
    const client = makeClient();

    client.setQueryData(postsQueryDef.queryKey({ id: 1 }), {
      id: 1,
      title: 'Cached',
    } satisfies Post);
    await invalidateQueries(client, postsQueryDef, { id: 1 });

    expect(client.getQueryState(postsQueryDef.queryKey({ id: 1 }))?.isInvalidated).toBe(true);
  });

  it('triggers a re-fetch on actively subscribed queries', async () => {
    const client = makeClient();
    const wrapper = makeWrapper(client);

    const { result } = renderHook(() => postsQueryDef.useQuery({ id: 3 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callsBefore = postFetcher.mock.calls.length;
    await act(async () => {
      await invalidateQueries(client, postsQueryDef, { id: 3 });
    });

    await waitFor(() => expect(postFetcher.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('uses queryDef for keys — no raw string involved', async () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    await invalidateQueries(client, postsQueryDef, { id: 5 });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: postsQueryDef.queryKey({ id: 5 }) }),
    );
  });

  it('without params — calls invalidateQueries once (does not throw)', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    await expect(invalidateQueries(client, postsQueryDef)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// setQueryData
// ---------------------------------------------------------------------------

describe('cacheHelpers — setQueryData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates cache without making a network request', () => {
    const client = makeClient();

    setQueryData(client, postsQueryDef, { id: 10 }, { id: 10, title: 'Override' });

    expect(client.getQueryData(postsQueryDef.queryKey({ id: 10 }))).toEqual({
      id: 10,
      title: 'Override',
    });
    expect(postFetcher).not.toHaveBeenCalled();
  });

  it('updater function receives old value and returns new value', () => {
    const client = makeClient();

    client.setQueryData(postsQueryDef.queryKey({ id: 20 }), {
      id: 20,
      title: 'Original',
    } satisfies Post);

    setQueryData(client, postsQueryDef, { id: 20 }, (prev) => ({
      id: prev?.id ?? 20,
      title: `Updated: ${prev?.title ?? ''}`,
    }));

    expect(client.getQueryData(postsQueryDef.queryKey({ id: 20 }))).toEqual({
      id: 20,
      title: 'Updated: Original',
    });
  });

  it('uses queryDef key — no raw string', () => {
    const client = makeClient();
    const setSpy = vi.spyOn(client, 'setQueryData');

    setQueryData(client, postsQueryDef, { id: 7 }, { id: 7, title: 'Direct' });

    expect(setSpy).toHaveBeenCalledWith(postsQueryDef.queryKey({ id: 7 }), expect.anything());
  });

  it('hook reflects updated cache value immediately (no refetch)', async () => {
    const client = makeClient();

    const { result } = renderHook(() => postsQueryDef.useQuery({ id: 30 }, { enabled: false }), {
      wrapper: makeWrapper(client),
    });

    act(() => {
      setQueryData(client, postsQueryDef, { id: 30 }, { id: 30, title: 'Injected' });
    });

    await waitFor(() => expect(result.current.data).toEqual({ id: 30, title: 'Injected' }));
    expect(postFetcher).not.toHaveBeenCalled();
  });
});
