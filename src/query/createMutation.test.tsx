import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createMutation } from './createMutation';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

interface CreateUserInput {
  name: string;
}
interface User {
  id: number;
  name: string;
}

describe('createMutation', () => {
  it('returns a MutationDefinition with mutationFn and useMutation', () => {
    const def = createMutation(
      async (input: CreateUserInput): Promise<User> => ({
        id: 1,
        name: input.name,
      }),
    );

    expect(typeof def.mutationFn).toBe('function');
    expect(typeof def.useMutation).toBe('function');
  });

  it('mutationFn calls the underlying fn with variables', async () => {
    const fn = vi.fn(
      async (input: CreateUserInput): Promise<User> => ({ id: 1, name: input.name }),
    );
    const def = createMutation(fn);

    const result = await def.mutationFn({ name: 'Alice' });

    expect(fn).toHaveBeenCalledWith({ name: 'Alice' });
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  it('useMutation exposes mutate', () => {
    const def = createMutation(
      async (input: CreateUserInput): Promise<User> => ({
        id: 1,
        name: input.name,
      }),
    );

    const { result } = renderHook(() => def.useMutation(), { wrapper: makeWrapper() });
    expect(typeof result.current.mutate).toBe('function');
  });

  it('useMutation exposes mutateAsync', () => {
    const def = createMutation(
      async (input: CreateUserInput): Promise<User> => ({
        id: 1,
        name: input.name,
      }),
    );

    const { result } = renderHook(() => def.useMutation(), { wrapper: makeWrapper() });
    expect(typeof result.current.mutateAsync).toBe('function');
  });

  it('useMutation exposes isPending as false before mutation', () => {
    const def = createMutation(
      async (input: CreateUserInput): Promise<User> => ({
        id: 1,
        name: input.name,
      }),
    );

    const { result } = renderHook(() => def.useMutation(), { wrapper: makeWrapper() });
    expect(result.current.isPending).toBe(false);
  });

  it('useMutation data is undefined before mutation', () => {
    const def = createMutation(
      async (input: CreateUserInput): Promise<User> => ({
        id: 1,
        name: input.name,
      }),
    );

    const { result } = renderHook(() => def.useMutation(), { wrapper: makeWrapper() });
    expect(result.current.data).toBeUndefined();
  });

  it('mutate populates data on success', async () => {
    const def = createMutation(
      async (input: CreateUserInput): Promise<User> => ({
        id: 42,
        name: input.name,
      }),
    );

    const { result } = renderHook(() => def.useMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ name: 'Bob' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 42, name: 'Bob' });
  });

  it('mutateAsync resolves with returned data', async () => {
    const def = createMutation(
      async (input: CreateUserInput): Promise<User> => ({
        id: 7,
        name: input.name,
      }),
    );

    const { result } = renderHook(() => def.useMutation(), { wrapper: makeWrapper() });

    let resolved: User | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ name: 'Carol' });
    });

    expect(resolved).toEqual({ id: 7, name: 'Carol' });
  });

  it('isError and error are set on failure', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const def = createMutation(async (_: CreateUserInput): Promise<User> => {
      throw new Error('server error');
    });

    const { result } = renderHook(() => def.useMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ name: 'Dave' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('server error');
  });

  it('reset clears data and error back to idle state', async () => {
    const def = createMutation(
      async (input: CreateUserInput): Promise<User> => ({
        id: 1,
        name: input.name,
      }),
    );

    const { result } = renderHook(() => def.useMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ name: 'Eve' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
  });
});
