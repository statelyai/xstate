import { z } from 'zod';
import {
  assertEvent,
  createAsyncLogic,
  createMachine,
  setup,
  type ActorRefFromLogic
} from '../src/index.ts';

function expectType<T>(_v: T) {}

const fetchUser = createAsyncLogic({
  schemas: { output: z.object({ name: z.string() }) },
  run: async () => ({ name: 'David' })
});

const children = {
  fetch: z.custom<ActorRefFromLogic<typeof fetchUser>>()
};

describe('child completion events in resolver event unions', () => {
  it('includes done/error events of declared children in entry', () => {
    setup({
      actors: { fetchUser },
      schemas: {
        events: { go: z.object({ to: z.string() }) },
        children
      }
    }).createMachine({
      invoke: { id: 'fetch', src: 'fetchUser' },
      entry: ({ event }) => {
        assertEvent(event, 'xstate.done.actor');
        expectType<'fetch'>(event.actorId);
        expectType<string>(event.output.name);
      },
      exit: ({ event }) => {
        if (event.type === 'xstate.error.actor') {
          expectType<'fetch'>(event.actorId);
          expectType<unknown>(event.error);
        }
      }
    });

    createMachine({
      schemas: {
        events: { go: z.object({}) },
        children
      },
      invoke: { id: 'fetch', src: fetchUser },
      entry: ({ event }) => {
        assertEvent(event, 'xstate.done.actor');
        expectType<string>(event.output.name);
      }
    });

    expect(true).toBe(true);
  });

  it('keeps `on` handlers narrowed to their event', () => {
    setup({
      schemas: {
        events: { go: z.object({ to: z.string() }) },
        children
      }
    }).createMachine({
      on: {
        go: ({ event }) => {
          expectType<{ type: 'go'; to: string }>(event);
          // @ts-expect-error - `go` handlers never see completion events
          event.output;
        },
        'xstate.done.actor': ({ event }) => {
          expectType<string>(event.output.name);
        }
      }
    });

    expect(true).toBe(true);
  });

  it('narrows completion events when only children are declared', () => {
    setup({
      actors: { fetchUser },
      schemas: { children }
    }).createMachine({
      invoke: { id: 'fetch', src: 'fetchUser' },
      entry: ({ event }) => {
        assertEvent(event, 'xstate.done.actor');
        expectType<'fetch'>(event.actorId);
        expectType<string>(event.output.name);
      },
      on: {
        go: ({ event }) => {
          expectType<{ type: string }>(event);
          // @ts-expect-error - `go` handlers never see completion events
          event.output;
        }
      }
    });

    createMachine({
      schemas: { children },
      invoke: { id: 'fetch', src: fetchUser },
      entry: ({ event }) => {
        assertEvent(event, 'xstate.done.actor');
        expectType<'fetch'>(event.actorId);
        expectType<string>(event.output.name);
      }
    });

    expect(true).toBe(true);
  });

  it('does not add completion events without declared children', () => {
    setup({
      schemas: { events: { go: z.object({}) } }
    }).createMachine({
      entry: ({ event }) => {
        expectType<{ type: 'go' }>(event);
      }
    });

    expect(true).toBe(true);
  });
});
