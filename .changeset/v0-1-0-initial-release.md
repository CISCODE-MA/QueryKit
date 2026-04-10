---
"@ciscode/query-kit": minor
---

Initial public release v0.1.0.

- `createQuery` — typed query definition factory (key builder + fetcher + `useQuery` shorthand)
- `usePaginatedQuery` — offset and cursor pagination hook with flat data array
- `createMutation` — typed mutation definition factory (`useMutation` shorthand)
- `invalidateQueries` — type-safe query invalidation via `QueryDefinition` (no raw string keys)
- `setQueryData` — type-safe cache write via `QueryDefinition`
- Peer dependency: `@tanstack/react-query >= 5`
