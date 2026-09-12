import { describe, expect, it, vi } from 'vitest';
import {
  createActor,
  createAsyncLogic,
  initialTransition,
  SimulatedClock,
  toPromise,
  transition
} from 'xstate';
import {
  feedbackMachine,
  RETRY_DELAY,
  type Feedback
} from './feedbackMachine.ts';

describe('pure transitions', () => {
  // `initialTransition` and `transition` are pure: they take a snapshot and an
  // event and return the next snapshot. No actor, no timers, no side effects.
  it('starts in "editing" with an empty draft', () => {
    const [snapshot] = initialTransition(feedbackMachine);

    expect(snapshot.value).toBe('editing');
    expect(snapshot.context).toEqual({
      rating: 0,
      comment: '',
      id: null,
      error: null
    });
  });

  it('ignores "submit" while the draft is incomplete', () => {
    const [initial] = initialTransition(feedbackMachine);
    const [rated] = transition(feedbackMachine, initial, {
      type: 'rate',
      rating: 5
    });
    const [next] = transition(feedbackMachine, rated, { type: 'submit' });

    expect(next.value).toBe('editing');
  });

  it('submits once both fields are filled in', () => {
    const [initial] = initialTransition(feedbackMachine);
    const [rated] = transition(feedbackMachine, initial, {
      type: 'rate',
      rating: 5
    });
    const [commented] = transition(feedbackMachine, rated, {
      type: 'comment',
      comment: 'Fast and pure'
    });
    const [next] = transition(feedbackMachine, commented, { type: 'submit' });

    expect(next.value).toBe('submitting');
  });
});

describe('the running actor', () => {
  // `machine.provide()` returns a copy of the machine with some sources
  // replaced. Here it swaps the network call for a stub.
  const succeeds = feedbackMachine.provide({
    actors: {
      submitFeedback: createAsyncLogic({
        run: async ({ input }: { input: Feedback }) => ({
          id: `fb-${input.rating}`
        })
      })
    }
  });

  it('reaches "submitted" and produces the id from the actor', async () => {
    const actor = createActor(succeeds).start();

    actor.send({ type: 'rate', rating: 4 });
    actor.send({ type: 'comment', comment: 'Works for me' });
    actor.send({ type: 'submit' });

    await expect(toPromise(actor)).resolves.toEqual({ id: 'fb-4' });
  });

  it('lands in "failed" with the error message when the actor rejects', async () => {
    const fails = feedbackMachine.provide({
      actors: {
        submitFeedback: createAsyncLogic({
          run: async (_: { input: Feedback }) => {
            throw new Error('503 Service Unavailable');
          }
        })
      }
    });
    const actor = createActor(fails).start();

    actor.send({ type: 'rate', rating: 1 });
    actor.send({ type: 'comment', comment: 'Down again' });
    actor.send({ type: 'submit' });

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('failed'));
    expect(actor.getSnapshot().context.error).toBe('503 Service Unavailable');
  });
});

describe('delays', () => {
  // A `SimulatedClock` lets the test move time forward by hand, so a 3s
  // delayed transition is verified instantly and deterministically.
  it('retries after the delay elapses', async () => {
    let attempts = 0;
    const flaky = feedbackMachine.provide({
      actors: {
        submitFeedback: createAsyncLogic({
          run: async (_: { input: Feedback }) => {
            attempts++;
            throw new Error('offline');
          }
        })
      }
    });
    const clock = new SimulatedClock();
    const actor = createActor(flaky, { clock }).start();

    actor.send({ type: 'rate', rating: 3 });
    actor.send({ type: 'comment', comment: 'Trying' });
    actor.send({ type: 'submit' });

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('failed'));
    expect(attempts).toBe(1);

    clock.increment(RETRY_DELAY - 1);
    expect(actor.getSnapshot().value).toBe('failed');

    clock.increment(1);
    expect(actor.getSnapshot().value).toBe('submitting');
    await vi.waitFor(() => expect(attempts).toBe(2));
  });
});
