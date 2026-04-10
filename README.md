# @ciscode/query-kit

Typed abstractions over [TanStack Query v5](https://tanstack.com/query/v5).
Define queries and mutations once — get typed keys, typed fetchers, and typed
cache helpers everywhere.

## Installation

```bash
npm install @ciscode/query-kit
```

### Peer dependencies

```bash
npm install @tanstack/react-query@^5 react@^18 react-dom@^18
```

> **Requires** `@tanstack/react-query >= 5`, `react >= 18`, `react-dom >= 18`.

---

## Quick start

Wrap your app in `QueryClientProvider` from `@tanstack/react-query` as usual,
then use `@ciscode/query-kit` to define and consume queries.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const client = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={client}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

---

## createQuery

Define a query once and get a fully typed definition that carries its key
builder, fetcher, and a `useQuery` shorthand together.

```ts
// queries/userQuery.ts
import { createQuery } from '@ciscode/query-kit';

interface User {
  id: number;
  name: string;
  email: string;
}

export const userQuery = createQuery(
  (params: { id: number }) => ['users', params.id] as const,
  async (params) => {
    const res = await fetch(`/api/users/${params.id}`);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json() as Promise<User>;
  },
);
```

### Using the query in a component

```tsx
// components/UserProfile.tsx
import { userQuery } from '../queries/userQuery';

export function UserProfile({ userId }: { userId: number }) {
  const { data, isLoading, isError, error } = userQuery.useQuery({ id: userId });

  if (isLoading) return <p>Loading…</p>;
  if (isError) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}
```

### Using the key and fetcher directly

```ts
// Access the key builder (e.g. for manual cache operations)
const key = userQuery.queryKey({ id: 42 }); // ['users', 42]

// Call the fetcher directly (e.g. in a server-side loader)
const user = await userQuery.queryFn({ id: 42 });
```

---

## usePaginatedQuery

Wraps either `useQuery` (offset mode) or `useInfiniteQuery` (cursor mode)
behind a unified API. Both modes return a flat `data` array.

### Offset-based pagination

```tsx
import { usePaginatedQuery } from '@ciscode/query-kit';
import { postsQuery } from '../queries/postsQuery';

// postsQuery is a createQuery definition whose fetcher accepts { page, pageSize }
export function PostsList() {
  const { data, isLoading, page, pageSize, nextPage, prevPage } = usePaginatedQuery(
    postsQuery,
    { page: 1, pageSize: 10 },
    { mode: 'offset', pageSize: 10, initialPage: 1 },
  );

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      {data.map((post) => (
        <article key={post.id}>{post.title}</article>
      ))}
      <button onClick={prevPage} disabled={page === 1}>
        Previous
      </button>
      <span>Page {page}</span>
      <button onClick={nextPage}>Next</button>
    </div>
  );
}
```

**Offset result shape**

| Property     | Type                  | Description                      |
| ------------ | --------------------- | -------------------------------- |
| `data`       | `T[]`                 | Flat array of current page items |
| `page`       | `number`              | Current page (starts at 1)       |
| `pageSize`   | `number`              | Items per page (default `20`)    |
| `totalPages` | `number \| undefined` | Total pages if known             |
| `nextPage`   | `() => void`          | Increment page                   |
| `prevPage`   | `() => void`          | Decrement page (floor at 1)      |
| `isLoading`  | `boolean`             |                                  |
| `isFetching` | `boolean`             |                                  |
| `isError`    | `boolean`             |                                  |
| `error`      | `Error \| null`       |                                  |

### Cursor-based pagination

```tsx
import { usePaginatedQuery } from '@ciscode/query-kit';
import { feedQuery } from '../queries/feedQuery';

// feedQuery fetcher accepts { cursor?: string | number | null | undefined }
export function Feed() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetching } = usePaginatedQuery(
    feedQuery,
    { cursor: undefined },
    {
      mode: 'cursor',
      getCursor: (page) => (page.length > 0 ? page[page.length - 1].id : undefined),
    },
  );

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      {data.map((item) => (
        <article key={item.id}>{item.title}</article>
      ))}
      {hasNextPage && (
        <button onClick={fetchNextPage} disabled={isFetching}>
          {isFetching ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
```

**Cursor result shape**

| Property        | Type                                    | Description                             |
| --------------- | --------------------------------------- | --------------------------------------- |
| `data`          | `T[]`                                   | Flat array of all loaded items          |
| `fetchNextPage` | `() => void`                            | Fetch the next page                     |
| `hasNextPage`   | `boolean`                               | `true` when `getCursor` returns a value |
| `nextCursor`    | `string \| number \| null \| undefined` | Cursor for the next page                |
| `isLoading`     | `boolean`                               |                                         |
| `isFetching`    | `boolean`                               |                                         |
| `isError`       | `boolean`                               |                                         |
| `error`         | `Error \| null`                         |                                         |

---

## createMutation

Define a mutation once and use it anywhere with full type safety.

```ts
// mutations/updateUser.ts
import { createMutation } from '@ciscode/query-kit';

interface UpdateUserInput {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

export const updateUserMutation = createMutation(async (input: UpdateUserInput): Promise<User> => {
  const res = await fetch(`/api/users/${input.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name }),
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
});
```

### Using the mutation in a component

```tsx
// components/EditUserForm.tsx
import { useQueryClient } from '@tanstack/react-query';
import { updateUserMutation } from '../mutations/updateUser';
import { userQuery } from '../queries/userQuery';
import { invalidateQueries } from '@ciscode/query-kit';

export function EditUserForm({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { mutate, isPending, isError, error } = updateUserMutation.useMutation();

  function handleSubmit(name: string) {
    mutate(
      { id: userId, name },
      {
        onSuccess: () => {
          // Invalidate the user query so it re-fetches fresh data.
          // No raw string keys — the key comes from userQuery.
          invalidateQueries(queryClient, userQuery, { id: userId });
        },
      },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const name = new FormData(e.currentTarget).get('name') as string;
        handleSubmit(name);
      }}
    >
      <input name="name" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </button>
      {isError && <p role="alert">Error: {error.message}</p>}
    </form>
  );
}
```

---

## Cache helpers

### invalidateQueries

Marks all matching queries as stale so they re-fetch. Uses the query
definition's key builder — no raw strings.

```ts
import { invalidateQueries } from '@ciscode/query-kit';

// Invalidate a specific user
await invalidateQueries(queryClient, userQuery, { id: 42 });

// Invalidate all queries matching the userQuery key prefix
await invalidateQueries(queryClient, userQuery);
```

### setQueryData

Write directly into the cache without a network request. Passing the wrong
`TData` shape is a TypeScript compile error.

```ts
import { setQueryData } from '@ciscode/query-kit';

// Direct replacement
setQueryData(
  queryClient,
  userQuery,
  { id: 42 },
  { id: 42, name: 'Alice', email: 'alice@example.com' },
);

// Updater function — receives the old value
setQueryData(queryClient, userQuery, { id: 42 }, (prev) => ({
  ...prev!,
  name: 'Alice Updated',
}));
```

---

## Full end-to-end pattern

```
define once (createQuery / createMutation)
     ↓
use in component (queryDef.useQuery / mutationDef.useMutation)
     ↓
on success → invalidateQueries / setQueryData (no raw strings)
```

---

## API reference

| Export                    | Kind       | Description                                        |
| ------------------------- | ---------- | -------------------------------------------------- |
| `createQuery`             | `function` | Creates a `QueryDefinition` (key + fetcher + hook) |
| `usePaginatedQuery`       | `function` | Offset or cursor pagination hook                   |
| `createMutation`          | `function` | Creates a `MutationDefinition` (fn + hook)         |
| `invalidateQueries`       | `function` | Type-safe query invalidation via `QueryDefinition` |
| `setQueryData`            | `function` | Type-safe cache write via `QueryDefinition`        |
| `QueryDefinition`         | `type`     | Shape returned by `createQuery`                    |
| `MutationDefinition`      | `type`     | Shape returned by `createMutation`                 |
| `OffsetPaginationOptions` | `type`     | Options for `usePaginatedQuery` offset mode        |
| `CursorPaginationOptions` | `type`     | Options for `usePaginatedQuery` cursor mode        |

---

## Scripts

```bash
npm run build       # build to dist/ (tsup — ESM + CJS + types)
npm test            # run tests (vitest)
npm run typecheck   # TypeScript typecheck
npm run lint        # ESLint
npm run format      # Prettier check
npx changeset       # create a changeset
```

## Release flow

- Work on a `feat/*` branch from `develop`
- Merge to `develop` via PR
- Add a changeset: `npx changeset`
- Promote `develop` → `master` via PR
- Tag `vX.Y.Z` to publish (npm OIDC)
