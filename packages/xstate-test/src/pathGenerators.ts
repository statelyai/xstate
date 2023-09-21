import { getShortestPaths, getSimplePaths } from '@xstate/graph';
import { ActorInternalState, EventObject } from 'xstate';
import { PathGenerator } from './types.ts';

export const createShortestPathsGen =
  <
    TSnapshot,
    TEvent extends EventObject,
    TInput,
    TOutput,
    TInternalState extends ActorInternalState<TSnapshot, TOutput>,
    TPersisted
  >(): PathGenerator<
    TSnapshot,
    TEvent,
    TInput,
    TOutput,
    TInternalState,
    TPersisted
  > =>
  (logic, defaultOptions) => {
    const paths = getShortestPaths(logic, defaultOptions);

    return paths;
  };

export const createSimplePathsGen =
  <
    TSnapshot,
    TEvent extends EventObject,
    TInput,
    TOutput,
    TInternalState extends ActorInternalState<TSnapshot, TOutput>,
    TPersisted
  >(): PathGenerator<
    TSnapshot,
    TEvent,
    TInput,
    TOutput,
    TInternalState,
    TPersisted
  > =>
  (logic, defaultOptions) => {
    const paths = getSimplePaths(logic, defaultOptions);

    return paths;
  };
