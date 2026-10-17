import { describe, expect, it } from 'vitest';
import {
  createAsyncLogic,
  createEmptyActor,
  createCallbackLogic,
  createEventObservableLogic,
  createLogic,
  createMachine,
  createObservableLogic,
  createSubscriptionLogic,
  createListenerLogic,
  initialTransition,
  type AnyActorLogic
} from '../src/index.ts';
import type { Actor } from '../src/createActor.ts';
import { createFSM } from '../src/fsm/index.ts';

describe('actor logic completion capability', () => {
  it('distinguishes attached listeners from logic that can complete', () => {
    expect(
      createFSM({ initial: 'waiting', states: { waiting: {} } }).completion
    ).toBe('never');
    expect((createEmptyActor() as Actor<AnyActorLogic>).logic.completion).toBe(
      'never'
    );
    expect(createCallbackLogic(() => {}).completion).toBe('never');
    expect(createSubscriptionLogic().completion).toBe('never');
    expect(createListenerLogic().completion).toBe('never');
    expect(createAsyncLogic({ run: async () => 1 }).completion).toBe(
      'possible'
    );
    const observable = () => ({ subscribe: () => ({ unsubscribe() {} }) });
    expect(createObservableLogic(observable).completion).toBe('possible');
    expect(createEventObservableLogic(observable).completion).toBe('possible');
    expect(
      createLogic({ context: {}, run: () => {}, completion: 'never' })
        .completion
    ).toBe('never');
  });

  it('classifies machine completion structurally, including parallel roots', () => {
    expect(createMachine({}).completion).toBe('never');
    expect(
      createMachine({
        initial: 'w',
        states: { w: {}, done: { type: 'final' } }
      }).completion
    ).toBe('possible');
    const nested = createMachine({
      initial: 'w',
      states: { w: { initial: 'done', states: { done: { type: 'final' } } } }
    });
    expect(nested.completion).toBe('never');
    const parallel = createMachine({
      type: 'parallel',
      states: {
        a: { initial: 'done', states: { done: { type: 'final' } } },
        b: { initial: 'done', states: { done: { type: 'final' } } }
      }
    });
    expect(parallel.completion).toBe('possible');
    expect(initialTransition(parallel)[0].status).toBe('done');
    expect(parallel.provide({}).completion).toBe('possible');
  });
});
