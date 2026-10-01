/* oxlint-disable typescript/require-await -- Exercise inference from plain async return values. */
import {
  createAsyncLogic,
  createCallbackLogic,
  createMachine,
  setup,
  types,
  type AnyActorLogic,
  type ActorRefFromLogic,
  type SnapshotFrom,
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

export function checkAsyncShorthand() {
  const s = setup({
    schemas: { context: types<{ id: number | undefined; name: string }>() },
    states: {
      loading: {
        schemas: {
          context: types<{ id: number }>(),
          input: types<{ label: string }>()
        }
      },
      ready: {}
    }
  });
  s.createMachine({
    context: { id: 1, name: '' },
    initial: { target: 'loading', input: { label: 'David' } },
    states: {
      loading: {
        invoke: s.createInvoke({
          schemas: {
            input: types<{ id: number; label: string }>(),
            output: types<{ name: string }>(),
            error: types<{ code: number }>()
          },
          input: ({ context, input }) => {
            concrete<typeof context.id>(true);
            concrete<typeof input.label>(true);
            // @ts-expect-error enclosing context remains narrowed and numeric
            const _bad: string = context.id;
            return { id: context.id, label: input.label };
          },
          src: async ({ input, signal, self }) => {
            concrete<typeof input>(true);
            concrete<typeof input.id>(true);
            concrete<typeof signal>(true);
            concrete<typeof self>(true);
            // @ts-expect-error actor input is numeric
            const _bad: string = input.id;
            return { name: input.label };
          },
          onDone: ({ context, event, output }) => {
            concrete<typeof context.id>(true);
            concrete<typeof event.output>(true);
            concrete<typeof output>(true);
            // @ts-expect-error declared output is a user object
            const _bad: number = event.output;
            return { target: 'ready', context: { name: event.output.name } };
          },
          onError: ({ event }) => {
            concrete<typeof event.error.code>(true);
            // @ts-expect-error declared errors remain numeric
            const _bad: string = event.error.code;
            return {};
          },
          onSnapshot: ({ event }) => {
            concrete<typeof event.snapshot>(true);
            concrete<typeof event.snapshot.input>(true);
            return {};
          }
        })
      },
      ready: {}
    }
  });
  const inferred = s.createInvoke({
    schemas: { input: types<{ id: number }>() },
    input: { id: 1 },
    src: async ({ input }) => ({ id: input.id, name: 'David' }),
    onDone: ({ event }) => {
      concrete<typeof event.output>(true);
      concrete<typeof event.output.id>(true);
      // @ts-expect-error return-inferred output has a concrete shape
      void event.output.missing;
      return {};
    }
  });
  concrete<OutputFrom<typeof inferred.src>>(true);
  s.createInvoke({
    schemas: { input: types<{ id: number }>() },
    input: { id: 1 },
    src: async ({ input }, enq) => {
      concrete<typeof input.id>(true);
      concrete<typeof enq>(true);
      return { name: String(input.id) };
    },
    onDone: {
      target: 'ready',
      context: ({ event, output }) => {
        concrete<typeof event.output.name>(true);
        concrete<typeof output.name>(true);
        // @ts-expect-error inferred output stays string in object-form mappers
        const _bad: number = event.output.name;
        return { name: output.name };
      }
    },
    onSnapshot: ({ event }) => {
      if (event.snapshot.status === 'done') {
        concrete<typeof event.snapshot.output.name>(true);
        // @ts-expect-error snapshot output stays string
        const _bad: number = event.snapshot.output.name;
      }
    }
  });
  s.createInvoke({
    schemas: { output: types<{ name: string; nickname?: string }>() },
    src: async () => ({ name: 'David' }),
    onDone: ({ event }) => {
      const _optional: string | undefined = event.output.nickname;
      // @ts-expect-error output uses declared schema, not the narrower return
      const _bad: string = event.output.nickname;
    }
  });
  const requiredSchema = { input: types<{ id: number }>() };
  const requiredSource = async ({ input }: { input: { id: number } }) =>
    input.id;
  const wrongStaticInput = {
    schemas: requiredSchema,
    input: { id: 'bad' },
    src: requiredSource
  };
  // @ts-expect-error static input must match its schema
  s.createInvoke(wrongStaticInput);
  const wrongMappedInput = {
    schemas: requiredSchema,
    input: () => ({ id: 'bad' }),
    src: requiredSource
  };
  // @ts-expect-error mapped input must match its schema
  s.createInvoke(wrongMappedInput);
  const undefinedInput = {
    schemas: requiredSchema,
    input: undefined,
    src: requiredSource
  };
  // @ts-expect-error undefined cannot satisfy required actor input
  s.createInvoke(undefinedInput);
  s.createInvoke({
    schemas: { input: types<{ id: number } | undefined>() },
    src: async ({ input }) => input?.id
  });
  // @ts-expect-error source logic keeps its own schemas
  s.createInvoke({
    src: createAsyncLogic({ run: async () => 1 }),
    schemas: { output: types<number>() }
  });

  s.createInvoke({
    src: async () => 42,
    onDone: ({ event }) => {
      concrete<typeof event.output>(true);
      // @ts-expect-error return-inferred output is numeric
      const _bad: string = event.output;
      return {};
    }
  });
  // @ts-expect-error async sources must return a promise-like result
  s.createInvoke({ src: () => 42 });
  const missingInput = { schemas: requiredSchema, src: requiredSource };
  // @ts-expect-error input schema requires input
  s.createInvoke(missingInput);
  // @ts-expect-error output schema checks the async return value
  s.createInvoke({
    schemas: { output: types<{ name: string }>() },
    src: async () => ({ name: 42 })
  });
}

export function checkAsyncContracts() {
  const child = createAsyncLogic({
    schemas: {
      input: types<{ id: number }>(),
      output: types<number>(),
      error: types<{ code: number }>()
    },
    run: async ({ input }) => input.id
  });
  const s = setup({
    schemas: {
      context: types<{ id: number }>(),
      children: { job: types<ActorRefFromLogic<typeof child>>() }
    },
    states: {
      loading: {},
      ready: { schemas: { input: types<{ label: string }>() } }
    }
  });
  s.createMachine({
    context: { id: 1 },
    initial: 'loading',
    states: {
      loading: {
        invoke: s.createInvoke({
          id: 'job',
          schemas: {
            input: types<{ id: number }>(),
            output: types<number>(),
            error: types<{ code: number }>()
          },
          input: ({ context }) => ({ id: context.id }),
          src: async ({ input }) => input.id,
          onDone: ({ event }) => ({
            target: 'ready',
            input: { label: String(event.output) }
          })
        })
      },
      ready: {}
    }
  });
  // @ts-expect-error declared child id must match
  s.createInvoke({
    id: 'other',
    schemas: { output: types<number>() },
    src: async () => 1
  });
  // @ts-expect-error async source must match declared child ref/output
  s.createInvoke({
    id: 'job',
    schemas: { output: types<string>() },
    src: async () => 'bad'
  });
  const plain = setup({
    schemas: { context: types<{ id: number }>() },
    states: {
      loading: {},
      ready: { schemas: { input: types<{ label: string }>() } }
    }
  });
  const unknownTarget = plain.createInvoke({
    src: async () => 1,
    onDone: () => ({ target: 'missing' })
  });
  const unknownTargetMachine = {
    context: { id: 1 },
    initial: { target: 'ready', input: { label: 'ok' } },
    invoke: unknownTarget,
    states: { ready: {} }
  } as const;
  // @ts-expect-error enclosing machine rejects unknown callback targets
  plain.createMachine(unknownTargetMachine);
  plain.createMachine({
    context: { id: 1 },
    initial: 'loading',
    states: {
      loading: {
        // @ts-expect-error inline callback target input must match its schema
        invoke: plain.createInvoke({
          src: async () => 1,
          onDone: () => ({ target: 'ready', input: { label: 1 } })
        })
      },
      ready: {}
    }
  });
  // @ts-expect-error callback context patches stay numeric
  plain.createInvoke({
    src: async () => 1,
    onDone: () => ({ context: { id: 'bad' } })
  });
  plain.createInvoke({
    src: async ({ signal }) => {
      concrete<typeof signal>(true);
      return { value: 1 };
    },
    onDone: ({ output }) => {
      concrete<typeof output.value>(true);
      // @ts-expect-error async args do not widen inferred output
      const _bad: string = output.value;
    }
  });
}

export function checkRequiredInputAndMachineChildren() {
  const job = createAsyncLogic({
    schemas: { input: types<{ id: number }>() },
    run: async ({ input }) => input.id
  });
  const s = setup({});
  s.createInvoke({ src: job, input: { id: 1 } });
  s.createInvoke({ src: job, input: () => ({ id: 1 }) });
  // @ts-expect-error required actor input cannot be omitted
  s.createInvoke({ src: job });
  // @ts-expect-error required actor input cannot be undefined
  s.createInvoke({ src: job, input: undefined });
  // @ts-expect-error required actor input mapper cannot return undefined
  s.createInvoke({ src: job, input: () => undefined });
  // @ts-expect-error static input must match the actor's schema
  s.createInvoke({ src: job, input: { id: 'wrong' } });
  // @ts-expect-error mapped input must match the actor's schema
  s.createInvoke({ src: job, input: () => ({ id: 'wrong' }) });
  const optionalJob = createAsyncLogic({
    schemas: { input: types<{ id: number } | undefined>() },
    run: async ({ input }) => input?.id ?? 0
  });
  s.createInvoke({ src: optionalJob });
  s.createInvoke({ src: optionalJob, input: undefined });
  s.createInvoke({ src: optionalJob, input: () => undefined });
  const machine = s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    invoke: s.createInvoke({
      id: 'job',
      src: job,
      input: { id: 1 },
      onDone: ({ event }) => {
        concrete<typeof event.output>(true);
        // @ts-expect-error child output remains numeric
        const _bad: string = event.output;
        return {};
      }
    })
  });
  concrete<SnapshotFrom<typeof machine>['children']['job']>(true);
  concrete<
    NonNullable<SnapshotFrom<typeof machine>['children']['job']>['getSnapshot']
  >(true);
  // @ts-expect-error snapshot child keys are not widened
  type _MissingChild = SnapshotFrom<typeof machine>['children']['missing'];
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    // @ts-expect-error machine-local children require a matching id
    invoke: s.createInvoke({ src: job, input: { id: 1 } })
  });
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    // @ts-expect-error machine-local children reject unknown ids
    invoke: s.createInvoke({ id: 'missing', src: job, input: { id: 1 } })
  });
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    // @ts-expect-error machine-local children reject incompatible sources
    invoke: s.createInvoke({
      id: 'job',
      src: createAsyncLogic({ run: async () => 'wrong' })
    })
  });
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    initial: 'parent',
    states: {
      parent: {
        initial: 'loading',
        states: {
          loading: {
            invoke: [
              s.createInvoke({
                id: 'job',
                src: createAsyncLogic({
                  schemas: { input: types<{ id: number }>() },
                  run: async ({ input }) => input.id
                }),
                input: { id: 1 },
                onDone: ({ event }) => {
                  concrete<typeof event.output>(true);
                  // @ts-expect-error inline actor output stays numeric
                  const _bad: string = event.output;
                  return {};
                }
              })
            ]
          }
        }
      }
    }
  });
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    initial: 'loading',
    states: {
      loading: {
        invoke: [
          s.createInvoke({ id: 'job', src: job, input: { id: 1 } }),
          // @ts-expect-error nested invoke arrays require declared child ids
          s.createInvoke({ src: job, input: { id: 1 } })
        ]
      }
    }
  });
  const other = createAsyncLogic({ run: async () => 'other' });
  s.createMachine({
    schemas: {
      children: {
        job: types<ActorRefFromLogic<typeof job>>(),
        other: types<ActorRefFromLogic<typeof other>>()
      }
    },
    // @ts-expect-error source must match its chosen id, not another declared child
    invoke: s.createInvoke({ id: 'other', src: job, input: { id: 1 } })
  });
  const hoisted = s.createInvoke({ id: 'job', src: job, input: { id: 1 } });
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    invoke: hoisted
  });
  const missingId = s.createInvoke({ src: job, input: { id: 1 } });
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    // @ts-expect-error hoisted invokes also require a matching child id
    invoke: missingId
  });
  const wrongId = s.createInvoke({ id: 'missing', src: job, input: { id: 1 } });
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    // @ts-expect-error hoisted invokes cannot use undeclared ids
    invoke: wrongId
  });
  const wrongSource = s.createInvoke({
    id: 'job',
    src: createAsyncLogic({ run: async () => 'wrong' })
  });
  s.createMachine({
    schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
    // @ts-expect-error hoisted invokes check id/source compatibility
    invoke: wrongSource
  });
}

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
