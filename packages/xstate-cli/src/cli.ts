import prompts from 'prompts';
import {
  InvokeConfig,
  SingleOrArray,
  TransitionConfig
} from 'xstate/src/types';

export const makePromptService = <T extends string, TContext>(
  prompt: prompts.PromptObject<T> | prompts.PromptObject<T>[],
  opts?: {
    onDone?:
      | string
      | SingleOrArray<
          TransitionConfig<TContext, { type: string; data: prompts.Answers<T> }>
        >;
    onError?:
      | string
      | SingleOrArray<
          TransitionConfig<TContext, { type: string; data: prompts.Answers<T> }>
        >;
  }
): InvokeConfig<TContext, any> => {
  return {
    src: async () => {
      const result = await prompts(prompt);

      return result;
    },
    onDone: opts?.onDone,
    onError: opts?.onError
  };
};
