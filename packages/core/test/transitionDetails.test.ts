import { describe, expect, it, vi } from 'vitest';

const createTransitionDetailsSpy = vi.fn();

vi.mock('../src/actorScope.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/actorScope.ts')>();
  return {
    ...actual,
    createTransitionDetails: (actorScope: any) => {
      createTransitionDetailsSpy(actorScope);
      return actual.createTransitionDetails(actorScope);
    }
  };
});

import { createActor, createMachine } from '../src';
import type { InspectionEvent } from '../src';
import { initialTransition, transition } from '../src/transition.ts';
import { transitionWithDetails } from '../src/graph/coverage.ts';
import {
  createTransitionDetails,
  getTransitionDetails
} from '../src/actorScope.ts';

const toggleMachine = createMachine({
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: { target: 'active' } } },
    active: { on: { TOGGLE: { target: 'inactive' } } }
  }
});

describe('transition details collection', () => {
  it('does not allocate transition details on the plain transition() path', () => {
    createTransitionDetailsSpy.mockClear();

    const [initialSnapshot] = initialTransition(toggleMachine);
    const [nextSnapshot] = transition(toggleMachine, initialSnapshot, {
      type: 'TOGGLE'
    });

    expect(nextSnapshot.value).toBe('active');
    expect(createTransitionDetailsSpy).not.toHaveBeenCalled();
  });

  it('allocates transition details only on the transitionWithDetails() path', () => {
    createTransitionDetailsSpy.mockClear();

    const [initialSnapshot] = initialTransition(toggleMachine);
    const [, , transitions] = transitionWithDetails(
      toggleMachine,
      initialSnapshot,
      { type: 'TOGGLE' }
    );

    expect(createTransitionDetailsSpy).toHaveBeenCalledTimes(1);
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('still collects inspection microsteps on the macrostep path when a details collector is attached', () => {
    const machine = createMachine({
      context: { count: 0 },
      initial: 'counting',
      states: {
        counting: {
          on: {
            GO: ({ context }) => ({ context: { count: context.count + 1 } })
          },
          always: ({ context }) =>
            context.count === 2 ? { target: 'done' } : undefined
        },
        done: {}
      }
    });

    const events: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (ev: InspectionEvent) => events.push(ev)
    });

    const details = createTransitionDetails(actor as any);

    actor.start();
    actor.send({ type: 'GO' });
    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().value).toBe('done');

    const macrostepEvent = (
      events.filter((ev) => ev.type === '@xstate.transition') as any[]
    ).find((ev) => ev.microsteps?.length > 1);

    expect(macrostepEvent).toBeDefined();
    expect(details.transitions.length).toBeGreaterThan(0);
  });
});
