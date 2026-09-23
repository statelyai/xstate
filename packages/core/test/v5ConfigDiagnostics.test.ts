import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createActor,
  createMachine,
  createMachineFromConfig,
  setup
} from '../src/index.ts';

const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('v5 config diagnostics', () => {
  it('throws on `cond`', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        states: {
          a: { on: { go: { target: 'b', cond: () => false } } },
          b: {}
        }
      } as any)
    ).toThrowError(
      'Transition "go" in state "(machine).a" uses "cond", which was removed. Use an inline transition function instead'
    );
  });

  it('throws on `cond` through setup().createMachine', () => {
    expect(() =>
      setup({}).createMachine({
        initial: 'a',
        states: {
          a: { on: { go: { target: 'b', cond: () => false } } },
          b: {}
        }
      } as any)
    ).toThrowError('uses "cond", which was removed');
  });

  it('throws on an object-form `guard` with a function value', () => {
    expect(() =>
      createMachine({
        id: 'm',
        initial: 'a',
        states: {
          a: { always: { target: 'b', guard: () => false } },
          b: {}
        }
      } as any)
    ).toThrowError(
      'Transition "always" in state "m.a" uses an object-form "guard", which was removed.'
    );
  });

  it('throws on an object-form `guard` with a string value', () => {
    expect(() =>
      createMachine({
        guards: { isReady: () => true },
        initial: 'a',
        states: {
          a: { on: { go: [{ target: 'b', guard: 'isReady' }] } },
          b: {}
        }
      } as any)
    ).toThrowError('uses an object-form "guard"');
  });

  it('throws on transitions nested in `invoke`', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: 'child',
              onDone: { target: 'b', cond: () => true }
            }
          },
          b: {}
        }
      } as any)
    ).toThrowError(
      'Transition "invoke.onDone" in state "(machine).a" uses "cond"'
    );
  });

  it('throws on a string `entry`', () => {
    expect(() =>
      createMachine({
        actions: { track: () => {} },
        initial: 'a',
        states: { a: { entry: 'track' } }
      } as any)
    ).toThrowError(
      'State "(machine).a" has a string ("track") as "entry", which is not supported. Use a single inline function `(args, enq) => { ... }`; call named actions with `enq(actions.name, params)`.'
    );
  });

  it('throws on an array `exit`', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        states: { a: { exit: [() => {}] } }
      } as any)
    ).toThrowError('State "(machine).a" has an array as "exit"');
  });

  it('throws on transition `actions`', () => {
    expect(() =>
      createMachine({
        actions: { track: () => {} },
        initial: 'a',
        states: {
          a: { on: { go: { target: 'b', actions: 'track' } } },
          b: {}
        }
      } as any)
    ).toThrowError(
      'Transition "go" in state "(machine).a" uses "actions", which was removed.'
    );
  });

  it.each(['types', 'tsTypes', 'schema'])('throws on `%s`', (key) => {
    expect(() => createMachine({ [key]: {} } as any)).toThrowError(
      /replaced by "schemas"|was removed\. Declare contracts under `schemas`/
    );
  });

  it.each([
    ['services', 'provide actor logic under "actors"'],
    ['activities', 'invoke an actor with "invoke" instead'],
    ['predictableActionArguments', 'removed with no replacement'],
    ['preserveActionOrder', 'removed with no replacement'],
    ['strict', 'removed with no replacement'],
    ['devTools', 'pass the "inspect" option to `createActor(...)`']
  ])('warns on `%s`', (key, replacement) => {
    const warn = warnSpy();
    createMachine({ [key]: true } as any);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(`"${key}"`);
    expect(warn.mock.calls[0][0]).toContain(replacement);
  });

  it('throws on an unresolvable `#id` target at construction', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        states: { a: { on: { go: { target: '#missing' } } } }
      } as any)
    ).toThrowError("Child state node '#missing' does not exist");
  });

  it('throws on an unresolvable sibling target at construction', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        states: { a: { on: { go: { target: 'nonexistent' } } } }
      } as any)
    ).toThrowError("Child state 'nonexistent' does not exist");
  });

  it('accepts v6 config without diagnostics', () => {
    const warn = warnSpy();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: () => {},
          on: { go: { target: 'b' }, fn: () => ({ target: 'b' }) }
        },
        b: {}
      }
    });
    createActor(machine).start();
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not diagnose compiled JSON configs', () => {
    const warn = warnSpy();
    const machine = createMachineFromConfig(
      {
        id: 'compiled',
        initial: 'a',
        states: {
          a: {
            entry: [{ type: 'track' }],
            on: {
              go: [
                {
                  target: 'b',
                  guard: { type: 'isAbove', params: { min: 1 } },
                  actions: [{ type: 'track' }]
                },
                {
                  target: 'c',
                  guard: {
                    type: 'xstate.not',
                    params: { guard: { type: 'isReady' } }
                  }
                }
              ],
              check: {
                target: 'b',
                guard: { type: 'xstate.stateIn', params: { stateId: '#b' } }
              }
            }
          },
          b: { id: 'b' },
          c: {}
        }
      },
      {
        actions: { track: () => {} },
        guards: {
          isAbove: (_: any, params: any) => params.min > 5,
          isReady: () => false
        }
      }
    );
    const actor = createActor(machine).start();
    actor.send({ type: 'go' });
    expect(actor.getSnapshot().value).toBe('c');
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports nothing in production builds', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('#is-development', () => ({ default: false }));
    try {
      const warn = warnSpy();
      const { createMachine: prodCreateMachine } =
        await import('../src/createMachine.ts');
      expect(() =>
        prodCreateMachine({
          types: {},
          devTools: true,
          initial: 'a',
          states: {
            a: { on: { go: { target: 'b', cond: () => false } } },
            b: {}
          }
        } as any)
      ).not.toThrow();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('#is-development');
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
