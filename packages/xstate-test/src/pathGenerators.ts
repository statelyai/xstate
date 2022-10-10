import {
  getShortestPaths,
  getSimplePaths,
  getShortestPathsTo,
  getShortestPathsFromTo,
  getSimplePathsTo,
  getSimplePathsFromTo
} from '@xstate/graph';
import { EventObject } from 'xstate';
import { PathGenerator } from './types';

export const createShortestPathsGen = <
  TState,
  TEvent extends EventObject
>(): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const paths = getShortestPaths(behavior, defaultOptions);

  return paths;
};

export const createShortestPathsToGen = <TState, TEvent extends EventObject>(
  predicate: (state: TState) => boolean
): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const paths = getShortestPathsTo(behavior, predicate, defaultOptions);

  return paths;
};

export const createShortestPathsFromToGen = <
  TState,
  TEvent extends EventObject
>(
  fromStatePredicate: (state: TState) => boolean,
  toStatePredicate: (state: TState) => boolean
): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const paths = getShortestPathsFromTo(
    behavior,
    fromStatePredicate,
    toStatePredicate,
    defaultOptions
  );

  return paths;
};

export const createSimplePathsGen = <
  TState,
  TEvent extends EventObject
>(): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const paths = getSimplePaths(behavior, defaultOptions);

  return paths;
};

export const createSimplePathsToGen = <TState, TEvent extends EventObject>(
  predicate: (state: TState) => boolean
): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const paths = getSimplePathsTo(behavior, predicate, defaultOptions);

  return paths;
};

export const createSimplePathsFromToGen = <TState, TEvent extends EventObject>(
  fromStatePredicate: (state: TState) => boolean,
  toStatePredicate: (state: TState) => boolean
): PathGenerator<TState, TEvent> => (behavior, defaultOptions) => {
  const paths = getSimplePathsFromTo(
    behavior,
    fromStatePredicate,
    toStatePredicate,
    defaultOptions
  );

  return paths;
};
