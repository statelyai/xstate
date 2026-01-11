import { getShortestPaths, getSimplePaths } from './index.ts';
import { EventObject, Snapshot } from '../index.ts';
import { PathGenerator } from './types.ts';

export const createShortestPathsGen =
  <
    TSnapshot extends Snapshot<unknown>,
    TEvent extends EventObject,
    TInput
  >(): PathGenerator<TSnapshot, TEvent, TInput> =>
  (logic, defaultOptions) => {
    const paths = getShortestPaths(logic, defaultOptions);

    return paths;
  };

export const createSimplePathsGen =
  <
    TSnapshot extends Snapshot<unknown>,
    TEvent extends EventObject,
    TInput
  >(): PathGenerator<TSnapshot, TEvent, TInput> =>
  (logic, defaultOptions) => {
    const paths = getSimplePaths(logic, defaultOptions);

    return paths;
  };
