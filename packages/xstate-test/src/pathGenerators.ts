import { getShortestPaths, getSimplePaths } from '@xstate/graph';
import { EventObject } from 'xstate';
import { PathGenerator } from './types';

export const createShortestPathsGen = <
  TState,
  TEvent extends EventObject
>(): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const paths = getShortestPaths(behavior, defaultOptions);

  return paths;
};

export const createSimplePathsGen = <
  TState,
  TEvent extends EventObject
>(): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const paths = getSimplePaths(behavior, defaultOptions);

  return paths;
};
