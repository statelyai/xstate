/* oxlint-disable typescript/require-await -- Exercise inference from plain async return values. */
import {
  createAsyncLogic,
  createCallbackLogic,
  createMachine,
  setup,
  types,
  type AnyActorLogic,
  type OutputFrom
} from '../../../src/index.ts';

// Explicit type arguments stop inference from weakening the assertion itself.
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsUnknown<T> =
  IsAny<T> extends true ? false : unknown extends T ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type Concrete<T> =
  IsAny<T> extends true
    ? false
    : IsUnknown<T> extends true
      ? false
      : IsNever<T> extends true
        ? false
        : true;
function concrete<T>(_: Concrete<T>) {}
function isAny<T>(_: IsAny<T>) {}
function isUnknown<T>(_: IsUnknown<T>) {}

// Verify that these guards actually reject every unwanted broad type.
// oxlint-disable-next-line eslint/no-constant-condition -- Invalid type probes must remain unreachable.
if (false) {
  // @ts-expect-error a concrete-type guard must reject any
  concrete<any>(true);
  // @ts-expect-error a concrete-type guard must reject unknown
  concrete<unknown>(true);
  // @ts-expect-error a concrete-type guard must reject never
  concrete<never>(true);
}

export function checkDeclaredScopes() {
  const numberLogic = createAsyncLogic({
    schemas: { output: types<number>() },
    run: async () => 42
  });
  const userLogic = createAsyncLogic({
    schemas: {
      input: types<{ id: number; label: string }>(),
      error: types<{ code: number }>()
    },
    run: async ({ input }) => ({ name: input.label, id: input.id })
  });
  const s = setup({
    schemas: {
      context: types<{
        id: number | undefined;
        requestId: string | undefined;
        name: string;
      }>(),
      events: { retry: types<{ force: boolean }>() },
      emitted: { loaded: types<{ name: string }>() }
    },
    actors: { numberLogic },
    actions: { log: (_name: string) => {} },
    states: {
      parent: {
        schemas: { context: types<{ requestId: string }>() },
        states: {
          loading: {
            schemas: {
              context: types<{ id: number }>(),
              input: types<{ label: string }>()
            }
          },
          ready: {}
        }
      }
    }
  });
  s.createMachine({
    context: { id: 7, requestId: 'request', name: '' },
    initial: 'parent',
    states: {
      parent: {
        initial: { target: 'loading', input: { label: 'David' } },
        states: {
          loading: {
            invoke: [
              s.createInvoke({
                src: userLogic,
                input: ({ context, input, event }) => {
                  concrete<typeof context>(true);
                  concrete<typeof context.id>(true);
                  concrete<typeof context.requestId>(true);
                  concrete<typeof input>(true);
                  concrete<typeof input.label>(true);
                  concrete<typeof event>(true);
                  if (event.type === 'retry') {
                    concrete<typeof event.force>(true);
                    // @ts-expect-error event payload retains its boolean type
                    const _bad: string = event.force;
                  }
                  // @ts-expect-error narrowed context.id is not a string
                  const _bad: string = context.id;
                  return { id: context.id, label: input.label };
                },
                onDone: ({ context, event, output, actions }, enq) => {
                  concrete<typeof context>(true);
                  concrete<typeof context.id>(true);
                  concrete<typeof context.requestId>(true);
                  concrete<typeof event>(true);
                  concrete<typeof event.output>(true);
                  concrete<typeof event.output.name>(true);
                  concrete<typeof output>(true);
                  concrete<typeof actions.log>(true);
                  concrete<typeof enq>(true);
                  const name: string = event.output.name;
                  // @ts-expect-error output is a concrete user object
                  const _bad: number = event.output;
                  // @ts-expect-error output does not allow arbitrary properties
                  void event.output.missing;
                  enq(actions.log, name);
                  enq.emit({ type: 'loaded', name });
                  // @ts-expect-error enqueue action parameters are not erased
                  enq(actions.log, 42);
                  // @ts-expect-error emitted payloads are not erased
                  enq.emit({ type: 'loaded', name: 42 });
                  return { target: 'ready', context: { name } };
                },
                onError: ({ context, event }) => {
                  concrete<typeof context.id>(true);
                  concrete<typeof event.error>(true);
                  concrete<typeof event.error.code>(true);
                  // @ts-expect-error declared error code remains numeric
                  const _bad: string = event.error.code;
                  return {};
                },
                onSnapshot: ({ context, event }) => {
                  concrete<typeof context.id>(true);
                  concrete<typeof event.snapshot>(true);
                  concrete<typeof event.snapshot.input>(true);
                  if (event.snapshot.input) {
                    concrete<typeof event.snapshot.input.id>(true);
                    // @ts-expect-error snapshot input retains its numeric id
                    const _bad: string = event.snapshot.input.id;
                  }
                  if (event.snapshot.status === 'done') {
                    concrete<typeof event.snapshot.output>(true);
                    concrete<typeof event.snapshot.output.name>(true);
                  }
                  return {};
                },
                timeout: ({ context, event }) => {
                  concrete<typeof context.id>(true);
                  concrete<typeof event>(true);
                  return context.id;
                },
                onTimeout: ({ context, event }) => {
                  concrete<typeof context.id>(true);
                  concrete<typeof event>(true);
                  concrete<typeof event.actorId>(true);
                  return {};
                }
              }),
              {
                src: 'numberLogic',
                onDone: ({ event, output }) => {
                  concrete<typeof event.output>(true);
                  concrete<typeof output>(true);
                  // @ts-expect-error raw registered invokes retain numeric output
                  const _bad: string = event.output;
                  return {};
                }
              },
              {
                src: numberLogic,
                onDone: ({ event }) => {
                  concrete<typeof event.output>(true);
                  // @ts-expect-error registered logic values retain numeric output
                  const _bad: string = event.output;
                  return {};
                }
              },
              {
                src: ({ actors }) => actors.numberLogic,
                onDone: ({ event }) => {
                  concrete<typeof event.output>(true);
                  // @ts-expect-error registered resolvers retain numeric output
                  const _bad: string = event.output;
                  return {};
                }
              }
            ]
          },
          ready: {}
        }
      }
    }
  });
  const extracted = s.createStateConfig('parent.loading', {
    invoke: s.createInvoke({
      src: userLogic,
      input: ({ context, input }) => {
        concrete<typeof context.id>(true);
        concrete<typeof context.requestId>(true);
        concrete<typeof input>(true);
        return { id: context.id, label: input.label };
      },
      onDone: ({ event }) => {
        concrete<typeof event.output>(true);
        return { target: 'ready' };
      }
    })
  });
  concrete<typeof extracted.invoke.src>(true);
  concrete<OutputFrom<typeof extracted.invoke.src>>(true);
}

export function checkFactoriesAndLogicKinds() {
  const s = setup({
    schemas: { context: types<{ name: string }>() },
    actors: { other: createAsyncLogic({ run: async () => 42 }) }
  });
  s.createMachine({
    context: { name: '' },
    invoke: [
      s.createInvoke({
        src: createAsyncLogic({ run: async () => ({ name: 'David' }) }),
        onDone: ({ event, output }) => {
          concrete<typeof event.output>(true);
          concrete<typeof output>(true);
          // @ts-expect-error unannotated async output still has a concrete shape
          void event.output.missing;
          return { context: { name: event.output.name } };
        }
      }),
      s.createInvoke({
        src: createAsyncLogic({
          schemas: { output: types<{ name: string }>() },
          run: async () => ({ name: 'David' })
        }),
        onDone: {
          context: ({ context, event, output }) => {
            concrete<typeof context.name>(true);
            concrete<typeof event.output>(true);
            concrete<typeof output>(true);
            // @ts-expect-error object-form context mapper retains output shape
            void event.output.missing;
            return { name: event.output.name };
          }
        }
      }),
      s.createInvoke({
        src: createAsyncLogic({ run: async () => true }),
        onDone: ({ event }) => {
          concrete<typeof event.output>(true);
          // @ts-expect-error distinct invocation output does not become any
          const _bad: string = event.output;
          return {};
        }
      }),
      s.createInvoke({
        src: createCallbackLogic({
          schemas: { input: types<{ name: string }>() },
          run: () => () => {}
        }),
        input: ({ context }) => ({ name: context.name }),
        onSnapshot: ({ event }) => {
          concrete<typeof event.snapshot>(true);
          concrete<typeof event.snapshot.input>(true);
          concrete<typeof event.snapshot.input.name>(true);
          // @ts-expect-error callback snapshot input retains its declared fields
          void event.snapshot.input.missing;
          return {};
        }
      }),
      s.createInvoke({
        src: createMachine({
          schemas: {
            context: types<{ name: string }>(),
            input: types<{ name: string }>(),
            output: types<{ length: number }>()
          },
          context: ({ input }) => ({ name: input.name }),
          initial: 'done',
          states: { done: { type: 'final' } },
          output: ({ context }) => ({ length: context.name.length })
        }),
        input: ({ context }) => ({ name: context.name }),
        onDone: ({ event }) => {
          concrete<typeof event.output>(true);
          concrete<typeof event.output.length>(true);
          // @ts-expect-error machine actor output remains numeric
          const _bad: string = event.output.length;
          return {};
        },
        onSnapshot: ({ event }) => {
          concrete<typeof event.snapshot>(true);
          concrete<typeof event.snapshot.context.name>(true);
          return {};
        }
      }),
      {
        src: 'other',
        onDone: ({ event }) => {
          concrete<typeof event.output>(true);
          // @ts-expect-error mixing logic kinds does not erase registered output
          const _bad: string = event.output;
          return {};
        }
      }
    ]
  });
}

// Broad types already declared by a source are preserved, not invented away.
export function checkIntentionalBroadTypes(erased: AnyActorLogic) {
  const s = setup({});
  s.createMachine({
    invoke: [
      s.createInvoke({
        src: erased,
        onDone: ({ event }) => {
          isAny<typeof event.output>(true);
          return {};
        }
      }),
      s.createInvoke({
        src: createAsyncLogic({
          schemas: { output: types<unknown>() },
          run: async () => 42
        }),
        onDone: ({ event }) => {
          isUnknown<typeof event.output>(true);
          // @ts-expect-error an explicitly unknown output must stay unknown
          void event.output.missing;
          return {};
        }
      }),
      s.createInvoke({
        src: createAsyncLogic({ run: async () => 42 }),
        onError: ({ event }) => {
          isUnknown<typeof event.error>(true);
          // @ts-expect-error errors without a declared schema remain unknown
          void event.error.code;
          return {};
        }
      })
    ]
  });
}
