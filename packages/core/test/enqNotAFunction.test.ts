import { z } from 'zod';
import {
  createActor,
  createMachine,
  initialTransition,
  setup,
  transition
} from '../src/index.ts';
import { standardSchemaValidator } from '../src/validation/index.ts';

describe('enq with a value that is not a function', () => {
  const warning =
    'enq(...) received undefined instead of a function, so nothing was enqueued.';

  const createFormMachine = (validated: boolean) =>
    setup({
      ...(validated && { validator: standardSchemaValidator() }),
      schemas: {
        ...(validated && {
          events: { submit: z.object({}) },
          emitted: { saved: z.object({}) }
        }),
        // Declared, never implemented
        actions: { track: { params: z.object({ key: z.string() }) } }
      }
    }).createMachine({
      initial: 'editing',
      states: {
        editing: {
          on: {
            submit: ({ actions }, enq) => {
              enq(actions.track, { key: 'submit' });
              return { target: 'sent' };
            }
          }
        },
        sent: {}
      }
    });

  it('skips an action that has no implementation instead of emitting it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const emitted: unknown[] = [];
      const actor = createActor(createFormMachine(false));
      actor.on('*', (event) => emitted.push(event));
      actor.start();
      expect(actor.getSnapshot().can({ type: 'submit' })).toBe(true);
      expect(warn).not.toHaveBeenCalled();
      actor.send({ type: 'submit' });

      expect(actor.getSnapshot().value).toBe('sent');
      expect(emitted).toEqual([]);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(warning)
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('does not error a validated machine that declares emitted events', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const actor = createActor(createFormMachine(true)).start();
      actor.send({ type: 'submit' });

      expect(actor.getSnapshot().status).toBe('active');
      expect(actor.getSnapshot().value).toBe('sent');
    } finally {
      warn.mockRestore();
    }
  });

  it('returns no effect for it from a pure transition', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const machine = createFormMachine(false);
      const [initial] = initialTransition(machine);
      const [next, effects] = transition(machine, initial, { type: 'submit' });

      expect(next.value).toBe('sent');
      expect(effects).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('still runs the other enqueued actions after provide() removed one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const track = vi.fn();
      const log = vi.fn();
      const machine = createMachine({
        actions: { track, log },
        on: {
          ping: ({ actions }, enq) => {
            enq(actions.log, 'before');
            enq(actions.track, 'ping');
            enq(actions.log, 'after');
          }
        }
      });
      const emitted: unknown[] = [];
      const actor = createActor(
        machine.provide({ actions: { track: undefined } })
      );
      actor.on('*', (event) => emitted.push(event));
      actor.start();
      actor.send({ type: 'ping' });

      expect(log.mock.calls).toEqual([['before'], ['after']]);
      expect(track).not.toHaveBeenCalled();
      expect(emitted).toEqual([]);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(warning)
      );
    } finally {
      warn.mockRestore();
    }
  });

  it.each([
    [null, 'null'],
    [false, 'false'],
    ['track', 'the string "track"'],
    [{ type: 'track' }, 'an object']
  ])('skips %j and names it in the warning', (value, received) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const machine = createMachine({
        entry: (_, enq) => {
          enq(value as any);
        }
      });
      const emitted: unknown[] = [];
      const actor = createActor(machine);
      actor.on('*', (event) => emitted.push(event));
      actor.start();

      expect(actor.getSnapshot().status).toBe('active');
      expect(emitted).toEqual([]);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(
          `enq(...) received ${received} instead of a function`
        )
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('skips it in production builds too, without a warning', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('#is-development', () => ({ default: false }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const prod = await import('../src/index.ts');
      const machine = prod.createMachine({
        initial: 'editing',
        states: {
          editing: {
            on: {
              submit: (_, enq) => {
                enq(undefined as any);
                return { target: 'sent' };
              }
            }
          },
          sent: {}
        }
      });
      const emitted: unknown[] = [];
      const actor = prod.createActor(machine);
      actor.on('*', (event) => emitted.push(event));
      actor.start();
      actor.send({ type: 'submit' });

      expect(actor.getSnapshot().value).toBe('sent');
      expect(emitted).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      vi.doUnmock('#is-development');
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
