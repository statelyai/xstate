import { getShortestPaths, getSimplePaths } from '@xstate/graph';
import { EventObject } from 'xstate';
import { PathGenerator } from './types.ts';

export const createShortestPathsGen =
  <TState, TEvent extends EventObject>(): PathGenerator<TState, TEvent> =>
  (logic, defaultOptions) => {
    const paths = getShortestPaths(logic, defaultOptions);

    return paths;
  };

export const createSimplePathsGen =
  <TState, TEvent extends EventObject>(): PathGenerator<TState, TEvent> =>
  (logic, defaultOptions) => {
    const paths = getSimplePaths(logic, defaultOptions);

    return paths;
  };
