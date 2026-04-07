import { useMutation as useTanstackMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

export type MutationFn<TVariables, TData> = (variables: TVariables) => Promise<TData>;

export interface MutationDefinition<TVariables, TData> {
  mutationFn: MutationFn<TVariables, TData>;
  useMutation: () => UseMutationResult<TData, Error, TVariables>;
}

export function createMutation<TVariables, TData>(
  fn: MutationFn<TVariables, TData>,
): MutationDefinition<TVariables, TData> {
  return {
    mutationFn: fn,
    useMutation() {
       
      return useTanstackMutation<TData, Error, TVariables>({
        mutationFn: fn,
      });
    },
  };
}
