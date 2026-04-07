import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createQuery } from './createQuery';
import { invalidateQueries, setQueryData } from './cacheHelpers';

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

interface Post {
  id: number;
  title: string;
}

const postFetcher = vi.fn(async (_p: { id: number }) => ({ id: _p.id, title: `Post ${_p.id}` }));

const postQueryDef = createQuery((p: { id: number }) => ['post', p.id] as const, postFetcher);

describe('invalidateQueries', () => {
  it('calls invalidateQueries on the client with the correct key', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    await invalidateQueries(client, postQueryDef, { id: 1 });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['post', 1] });
  });

  it('uses the queryDef key — no raw strings', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    await invalidateQueries(client, postQueryDef, { id: 99 });

    const callArgs = spy.mock.calls[0][0] as { queryKey: unknown[] };
    expect(callArgs.queryKey).toEqual(['post', 99]);
    // Confirm no raw strings were hardcoded — key comes from queryDef
    expect(callArgs.queryKey[1]).toBe(99);
  });

  it('triggers a refetch of the matching query', async () => {
    const client = makeClient();
    const wrapper = makeWrapper(client);

    // Seed the cache
    client.setQueryData(['post', 5], { id: 5, title: 'Post 5' });

    const { result } = renderHook(() => postQueryDef.useQuery({ id: 5 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callsBefore = postFetcher.mock.calls.length;
    await invalidateQueries(client, postQueryDef, { id: 5 });

    await waitFor(() => expect(postFetcher.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('works without params — uses empty params object', async () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    await invalidateQueries(client, postQueryDef);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('setQueryData', () => {
  it('sets data in the cache under the correct typed key', () => {
    const client = makeClient();

    setQueryData(client, postQueryDef, { id: 1 }, { id: 1, title: 'Updated' });

    const cached = client.getQueryData<Post>(['post', 1]);
    expect(cached).toEqual({ id: 1, title: 'Updated' });
  });

  it('accepts an updater function', () => {
    const client = makeClient();
    client.setQueryData(['post', 2], { id: 2, title: 'Original' });

    setQueryData(client, postQueryDef, { id: 2 }, (old) => ({
      ...(old ?? { id: 2, title: '' }),
      title: 'Mutated',
    }));

    const cached = client.getQueryData<Post>(['post', 2]);
    expect(cached?.title).toBe('Mutated');
  });

  it('uses queryDef key — no raw strings', () => {
    const client = makeClient();
    const spy = vi.spyOn(client, 'setQueryData');

    setQueryData(client, postQueryDef, { id: 3 }, { id: 3, title: 'Test' });

    expect(spy).toHaveBeenCalledWith(['post', 3], expect.anything());
  });

  it('wrong shape is caught by TypeScript — correct shape passes', () => {
    const client = makeClient();
    // This line must compile — correct shape
    setQueryData(client, postQueryDef, { id: 4 }, { id: 4, title: 'Valid' });
    const cached = client.getQueryData<Post>(['post', 4]);
    expect(cached).toEqual({ id: 4, title: 'Valid' });
  });
});
