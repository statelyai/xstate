import { z } from 'zod';
import { createActor, createMachine } from '../src/index.ts';

const machine = createMachine({
  schemas: {
    context: z.object({ go: z.boolean() })
  },
  context: { go: false },
  initial: 'waiting',
  states: {
    waiting: {
      always: ({ context }) => (context.go ? { target: 'done' } : undefined)
    },
    done: {}
  }
});

describe('restoring into eventless transitions', () => {
  it('does not re-evaluate always transitions on restore', () => {
    const persisted = createActor(machine).start().getPersistedSnapshot();
    const tampered = {
      ...persisted,
      context: { go: true }
    } as typeof persisted;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const actor = createActor(machine, { snapshot: tampered }).start();
    warn.mockRestore();

    expect(actor.getSnapshot().value).toBe('waiting');
  });

  it('warns in development when the restored configuration has eventless transitions', () => {
    const persisted = createActor(machine).start().getPersistedSnapshot();
    const guard = vi.fn(() => undefined);
    const guarded = createMachine({
      initial: 'waiting',
      states: {
        waiting: { always: guard },
        done: {}
      }
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createActor(machine, { snapshot: persisted }).start();
    const guardedSnapshot = createActor(guarded).getPersistedSnapshot();
    guard.mockClear();
    createActor(guarded, { snapshot: guardedSnapshot });
    const calls = warn.mock.calls.slice();
    warn.mockRestore();

    expect(calls).toEqual([
      [
        'Restored snapshot is in state "(machine).waiting" which has eventless transitions; they are not re-evaluated until the next event'
      ],
      [
        'Restored snapshot is in state "(machine).waiting" which has eventless transitions; they are not re-evaluated until the next event'
      ]
    ]);
    // Detection is structural: no guard or transition function runs.
    expect(guard).not.toHaveBeenCalled();
  });

  it('does not warn when the restored configuration has no eventless transitions', () => {
    const plain = createMachine({ initial: 'a', states: { a: {} } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createActor(plain, {
      snapshot: createActor(plain).getPersistedSnapshot()
    }).start();
    const calls = warn.mock.calls.slice();
    warn.mockRestore();

    expect(calls).toEqual([]);
  });
});
