import {
  createActor,
  createAsyncLogic,
  createCallbackLogic,
  createSystem,
  initialTransition,
  type ActorRefFromLogic,
  type SnapshotFrom,
  setup,
  types,
  waitFor
} from '../src/index.ts';

const userLogic = createAsyncLogic({
  schemas: { input: types<{ id: number; label: string }>() },
  run: async ({ input }) => ({ id: input.id, name: input.label })
});

const registered = createAsyncLogic({ run: async () => 42 });

describe('setup.createInvoke', () => {
  it('runs an inline async source with schemas and narrowed state scope', async () => {
    const s = setup({
      schemas: { context: types<{ id: number | undefined; name: string }>() },
      states: {
        parent: {
          schemas: { context: types<{ id: number }>() },
          states: {
            loading: { schemas: { input: types<{ label: string }>() } },
            ready: {}
          }
        }
      }
    });
    const source = vi.fn();
    const machine = s.createMachine({
      context: { id: 7, name: '' },
      initial: 'parent',
      states: {
        parent: {
          initial: { target: 'loading', input: { label: 'David' } },
          states: {
            loading: {
              invoke: s.createInvoke({
                schemas: {
                  input: types<{ id: number; label: string }>(),
                  output: types<{ name: string }>()
                },
                input: ({ context, input }) => {
                  expectTypeOf(context.id).toEqualTypeOf<number>();
                  expectTypeOf(input.label).toEqualTypeOf<string>();
                  return { id: context.id, label: input.label };
                },
                src: async ({ input, signal }, enq) => {
                  expectTypeOf(input.id).toEqualTypeOf<number>();
                  expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
                  source(input);
                  const name = await enq.step('name', () => input.label);
                  return { name };
                },
                onDone: ({ context, event, output }) => {
                  expectTypeOf(context.id).toEqualTypeOf<number>();
                  expectTypeOf(event.output).toEqualTypeOf<{ name: string }>();
                  expectTypeOf(output).toEqualTypeOf<{ name: string }>();
                  return {
                    target: 'ready',
                    context: { name: event.output.name }
                  };
                }
              })
            },
            ready: {}
          }
        }
      }
    });
    initialTransition(machine);
    expect(source).not.toHaveBeenCalled();
    const actor = createActor(machine).start();
    await waitFor(actor, (snapshot) => snapshot.matches({ parent: 'ready' }));
    expect(source).toHaveBeenCalledExactlyOnceWith({ id: 7, label: 'David' });
    expect(actor.getSnapshot().context.name).toBe('David');
    actor.stop();
  });

  it('infers async return values independently alongside logic and named sources', async () => {
    const s = setup({
      schemas: {
        context: types<{ name: string; enabled: boolean; total: number }>()
      },
      actors: { registered }
    });
    const machine = s.createMachine({
      context: { name: '', enabled: false, total: 0 },
      invoke: [
        s.createInvoke({
          schemas: { input: types<{ name: string }>() },
          input: { name: 'David' },
          src: async ({ input }) => ({ name: input.name }),
          onDone: ({ event }) => {
            expectTypeOf(event.output).toEqualTypeOf<{ name: string }>();
            return { context: { name: event.output.name } };
          }
        }),
        s.createInvoke({
          src: async () => true,
          onDone: ({ event }) => {
            expectTypeOf(event.output).toEqualTypeOf<boolean>();
            return { context: { enabled: event.output } };
          }
        }),
        s.createInvoke({
          src: createAsyncLogic({ run: async () => 1 }),
          onDone: ({ event }) => {
            expectTypeOf(event.output).toEqualTypeOf<1>();
            return { context: { total: event.output } };
          }
        }),
        {
          src: 'registered',
          onDone: ({ event }) => {
            expectTypeOf(event.output).toEqualTypeOf<42>();
            return { context: { total: event.output } };
          }
        }
      ]
    });
    const actor = createActor(machine).start();
    await waitFor(
      actor,
      (snapshot) =>
        snapshot.context.name === 'David' &&
        snapshot.context.enabled &&
        snapshot.context.total === 42
    );
    actor.stop();
  });

  it('cancels inline async sources on state exit and handles invocation timeouts', async () => {
    const s = setup({ schemas: { events: { cancel: types<{}>() } } });
    let signal: AbortSignal | undefined;
    const source = vi.fn((args: { signal: AbortSignal }) => {
      signal = args.signal;
      return new Promise<void>(() => {});
    });
    const machine = s.createMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: s.createInvoke({ src: source }),
          on: { cancel: { target: 'done' } }
        },
        done: {}
      }
    });
    initialTransition(machine);
    expect(source).not.toHaveBeenCalled();
    const actor = createActor(machine).start();
    expect(source).toHaveBeenCalledTimes(1);
    actor.send({ type: 'cancel' });
    expect(signal?.aborted).toBe(true);
    actor.stop();

    const timeoutMachine = s.createMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: s.createInvoke({
            src: source,
            timeout: 1,
            onTimeout: ({ event }) => {
              expectTypeOf(event.type).toEqualTypeOf<'xstate.timeout.actor'>();
              return { target: 'done' };
            }
          })
        },
        done: {}
      }
    });
    const timeoutActor = createActor(timeoutMachine).start();
    await waitFor(timeoutActor, (snapshot) => snapshot.matches('done'));
    expect(signal?.aborted).toBe(true);
    timeoutActor.stop();
  });

  it('preserves inline async errors and snapshot callbacks', async () => {
    const s = setup({ schemas: { context: types<{ code: number }>() } });
    const snapshots = vi.fn();
    const machine = s.createMachine({
      context: { code: 0 },
      initial: 'loading',
      states: {
        loading: {
          invoke: s.createInvoke({
            schemas: {
              output: types<number>(),
              error: types<{ code: number }>()
            },
            src: async () => {
              throw { code: 409 };
            },
            onSnapshot: ({ event }) => {
              if (event.snapshot.status === 'error') {
                expectTypeOf(event.snapshot.error).toEqualTypeOf<{
                  code: number;
                }>();
              }
              snapshots(event.snapshot.status);
            },
            onError: ({ event }) => {
              expectTypeOf(event.error).toEqualTypeOf<{ code: number }>();
              return { target: 'failed', context: { code: event.error.code } };
            }
          })
        },
        failed: {}
      }
    });
    const actor = createActor(machine).start();
    await waitFor(actor, (snapshot) => snapshot.matches('failed'));
    expect(actor.getSnapshot().context.code).toBe(409);
    expect(snapshots).toHaveBeenCalledWith('active');
    actor.stop();
  });

  it('infers nested state context, state input and actor output alongside named actors', async () => {
    const s = setup({
      schemas: {
        context: types<{
          optionalId: number | undefined;
          requestId: string | undefined;
          user: { id: number; name: string } | undefined;
        }>(),
        events: { retry: types<{ force: boolean }>() }
      },
      actors: { registered },
      states: {
        parent: {
          schemas: { context: types<{ requestId: string }>() },
          states: {
            loading: {
              schemas: {
                context: types<{ optionalId: number }>(),
                input: types<{ label: string }>()
              }
            },
            ready: {}
          }
        }
      }
    });
    const machine = s.createMachine({
      context: { optionalId: 7, requestId: 'request', user: undefined },
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
                    expectTypeOf(context.optionalId).toEqualTypeOf<number>();
                    expectTypeOf(context.requestId).toEqualTypeOf<string>();
                    expectTypeOf(input.label).toEqualTypeOf<string>();
                    if (event.type === 'retry') {
                      expectTypeOf(event.force).toEqualTypeOf<boolean>();
                    }
                    return { id: context.optionalId, label: input.label };
                  },
                  onDone: ({ context, event }) => {
                    expectTypeOf(context.optionalId).toEqualTypeOf<number>();
                    expectTypeOf(context.requestId).toEqualTypeOf<string>();
                    expectTypeOf(event.output).toEqualTypeOf<{
                      id: number;
                      name: string;
                    }>();
                    if (false) {
                      // @ts-expect-error output is inferred from this invocation's logic
                      event.output.missing;
                    }
                    return { target: 'ready', context: { user: event.output } };
                  }
                }),
                {
                  src: 'registered',
                  onDone: ({ event }) => {
                    expectTypeOf(event.output).toEqualTypeOf<42>();
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
    const actor = createActor(machine).start();
    await new Promise<void>((resolve) => {
      actor.subscribe((snapshot) => {
        if (snapshot.matches({ parent: 'ready' })) resolve();
      });
    });
    expect(actor.getSnapshot().context.user).toEqual({ id: 7, name: 'David' });
    actor.stop();
  });

  it('checks static and mapped actor input without widening from onDone', () => {
    const s = setup({ schemas: { context: types<{ id: number }>() } });
    if (false) {
      // @ts-expect-error id must be numeric
      s.createInvoke({
        src: userLogic,
        input: { id: 'wrong', label: 'David' }
      });
      // @ts-expect-error mapper must return this actor's input
      s.createInvoke({
        src: userLogic,
        input: ({ context }) => ({ id: String(context.id), label: 'David' })
      });
      s.createInvoke({
        src: userLogic,
        input: { id: 7, label: 'David' },
        onDone: ({ event }) => {
          expectTypeOf(event.output).toEqualTypeOf<{
            id: number;
            name: string;
          }>();
          // @ts-expect-error output is not numeric
          const result: number = event.output;
          return {};
        }
      });
    }
  });

  it('infers independently from actor factories inline in an invoke array', () => {
    const s = setup({ actors: { registered } });
    s.createMachine({
      initial: 'parent',
      states: {
        parent: {
          initial: 'loading',
          states: {
            loading: {
              invoke: [
                s.createInvoke({
                  src: createAsyncLogic({
                    run: async () => ({ name: 'David' })
                  }),
                  onDone: ({ event, output }) => {
                    expectTypeOf(event.output).toEqualTypeOf<{
                      readonly name: 'David';
                    }>();
                    expectTypeOf(output).toEqualTypeOf<{
                      readonly name: 'David';
                    }>();
                    return {};
                  }
                }),
                s.createInvoke({
                  src: createAsyncLogic({ run: async () => true }),
                  onDone: ({ event }) => {
                    expectTypeOf(event.output).toEqualTypeOf<true>();
                    return {};
                  }
                }),
                {
                  src: 'registered',
                  onDone: ({ event }) => {
                    expectTypeOf(event.output).toEqualTypeOf<42>();
                    return {};
                  }
                }
              ]
            }
          }
        }
      }
    });
  });

  it('retains ancestor refinements in descendants without setup contracts', () => {
    const s = setup({
      schemas: {
        context: types<{ id: number | undefined }>()
      },
      states: {
        parent: { schemas: { context: types<{ id: number }>() } }
      }
    });
    s.createMachine({
      context: { id: 7 },
      initial: 'parent',
      states: {
        parent: {
          initial: 'loading',
          states: {
            loading: {
              invoke: s.createInvoke({
                src: userLogic,
                input: ({ context }) => {
                  expectTypeOf(context.id).toEqualTypeOf<number>();
                  return { id: context.id, label: 'David' };
                },
                onDone: ({ context }) => {
                  expectTypeOf(context.id).toEqualTypeOf<number>();
                  return {};
                }
              })
            }
          }
        }
      }
    });
  });

  it('checks state targets, target input and target context inside helper callbacks', () => {
    const s = setup({
      schemas: {
        context: types<{ user: { id: number; name: string } | undefined }>()
      },
      states: {
        loading: {},
        ready: {
          schemas: {
            input: types<{ name: string }>(),
            context: types<{ user: { id: number; name: string } }>()
          }
        }
      }
    });
    s.createMachine({
      context: { user: undefined },
      initial: 'loading',
      states: {
        loading: {
          invoke: s.createInvoke({
            src: userLogic,
            input: { id: 7, label: 'David' },
            onDone: ({ event }) => ({
              target: 'ready',
              input: { name: event.output.name },
              context: { user: event.output }
            })
          })
        },
        ready: {}
      }
    });
    if (false) {
      s.createMachine({
        context: { user: undefined },
        initial: 'loading',
        states: {
          loading: {
            // @ts-expect-error target input name must be a string
            invoke: s.createInvoke({
              src: userLogic,
              input: { id: 7, label: 'David' },
              onDone: ({ event }) => ({
                target: 'ready',
                input: { name: event.output.id },
                context: { user: event.output }
              })
            })
          },
          ready: {}
        }
      });
      // @ts-expect-error target is not a declared state
      s.createMachine({
        context: { user: undefined },
        initial: 'loading',
        states: {
          loading: {
            // @ts-expect-error the invoke target is not declared
            invoke: s.createInvoke({
              src: userLogic,
              input: { id: 7, label: 'David' },
              onDone: () => ({ target: 'missing' })
            })
          },
          ready: {}
        }
      });
      s.createMachine({
        context: { user: undefined },
        initial: 'loading',
        states: {
          loading: {
            // @ts-expect-error entering ready requires its narrowed context
            invoke: s.createInvoke({
              src: userLogic,
              input: { id: 7, label: 'David' },
              onDone: () => ({ target: 'ready', input: { name: 'David' } })
            })
          },
          ready: {}
        }
      });
    }
  });

  it('checks target arrays and system registry contracts', () => {
    const s = setup({
      schemas: { context: types<{ x: number }>() },
      states: {
        loading: {},
        ready: { schemas: { input: types<{ name: string }>() } }
      }
    });
    s.createMachine({
      context: { x: 1 },
      initial: 'loading',
      states: {
        loading: {
          invoke: s.createInvoke({
            src: registered,
            onDone: { target: ['ready'], input: { name: 'David' } }
          })
        },
        ready: {}
      }
    });
    if (false) {
      s.createMachine({
        context: { x: 1 },
        initial: 'loading',
        states: {
          loading: {
            // @ts-expect-error a target array requires ready's input
            invoke: s.createInvoke({
              src: registered,
              onDone: { target: ['ready'] }
            })
          },
          ready: {}
        }
      });
      s.createMachine({
        context: { x: 1 },
        initial: 'loading',
        states: {
          loading: {
            // @ts-expect-error a target array checks ready's input fields
            invoke: s.createInvoke({
              src: registered,
              onDone: { target: ['ready'], input: { name: 42 } }
            })
          },
          ready: {}
        }
      });
      // @ts-expect-error conflicting targets are not valid in a compound machine
      s.createMachine({
        context: { x: 1 },
        initial: 'loading',
        states: {
          loading: {
            invoke: s.createInvoke({
              src: registered,
              onDone: { target: ['loading', 'ready'], input: { name: 'David' } }
            })
          },
          ready: {}
        }
      });
    }
    const receiver = createCallbackLogic<{ type: 'HELLO'; name: string }>(
      () => {}
    );
    const other = createCallbackLogic<{ type: 'OTHER'; id: number }>(() => {});
    const app = createSystem({ registry: { receiver } });
    const systemSetup = app.setup();
    systemSetup.createMachine({
      invoke: systemSetup.createInvoke({
        src: receiver,
        registryKey: 'receiver'
      })
    });
    if (false) {
      systemSetup.createMachine({
        // @ts-expect-error source must implement the registry's receiver contract
        invoke: systemSetup.createInvoke({
          src: other,
          registryKey: 'receiver'
        })
      });
    }
  });

  it('types errors, snapshots and context mappers from the source logic', () => {
    const logic = createAsyncLogic({
      schemas: { error: types<{ code: number }>() },
      run: async () => ({ name: 'David' })
    });
    const s = setup({
      schemas: { context: types<{ name: string }>() },
      actions: { log: (name: string) => {} },
      actors: { registered }
    });
    s.createMachine({
      context: { name: '' },
      invoke: s.createInvoke({
        src: logic,
        onDone: {
          context: ({ event, output, context, actions }) => {
            expectTypeOf(event.output.name).toEqualTypeOf<'David'>();
            expectTypeOf(output.name).toEqualTypeOf<'David'>();
            expectTypeOf(context.name).toEqualTypeOf<string>();
            expectTypeOf(actions.log).toEqualTypeOf<(name: string) => void>();
            return { name: event.output.name };
          }
        },
        onError: ({ event }) => {
          expectTypeOf(event.error).toEqualTypeOf<{ code: number }>();
          if (false) {
            // @ts-expect-error error.code is numeric
            const code: string = event.error.code;
          }
          return {};
        },
        onSnapshot: ({ event }) => {
          expectTypeOf(event.snapshot).toEqualTypeOf<
            SnapshotFrom<typeof logic>
          >();
          return {};
        },
        timeout: ({ context }) => context.name.length + 1,
        onTimeout: ({ event }) => {
          expectTypeOf(event.type).toEqualTypeOf<'xstate.timeout.actor'>();
          return {};
        }
      })
    });
  });

  it('preserves explicit child ids and logic compatibility', () => {
    const s = setup({
      schemas: {
        children: { user: types<ActorRefFromLogic<typeof userLogic>>() }
      }
    });
    s.createMachine({
      invoke: s.createInvoke({
        id: 'user',
        src: userLogic,
        input: { id: 7, label: 'David' }
      })
    });
    if (false) {
      // @ts-expect-error declared children require an id
      s.createInvoke({ src: userLogic, input: { id: 7, label: 'David' } });
      // @ts-expect-error unknown child id
      s.createInvoke({
        id: 'missing',
        src: userLogic,
        input: { id: 7, label: 'David' }
      });
      // @ts-expect-error this source does not implement the user child contract
      s.createInvoke({
        id: 'user',
        src: registered
      });
    }
  });

  it('starts machine-declared children under their ids with static and mapped input', async () => {
    const s = setup({ schemas: { context: types<{ id: number }>() } });
    const optionalLogic = createAsyncLogic({
      schemas: { input: types<{ label: string } | undefined>() },
      run: async ({ input }) => input?.label ?? 'default'
    });
    const machine = s.createMachine({
      schemas: {
        children: {
          staticUser: types<ActorRefFromLogic<typeof userLogic>>(),
          mappedUser: types<ActorRefFromLogic<typeof userLogic>>(),
          optional: types<ActorRefFromLogic<typeof optionalLogic>>()
        }
      },
      context: { id: 7 },
      initial: 'parent',
      states: {
        parent: {
          initial: 'loading',
          states: {
            loading: {
              invoke: [
                s.createInvoke({
                  id: 'staticUser',
                  src: userLogic,
                  input: { id: 1, label: 'static' }
                }),
                s.createInvoke({
                  id: 'mappedUser',
                  src: userLogic,
                  input: ({ context }) => {
                    expectTypeOf(context.id).toEqualTypeOf<number>();
                    return { id: context.id, label: 'mapped' };
                  },
                  onDone: ({ event }) => {
                    expectTypeOf(event.output.name).toEqualTypeOf<string>();
                    return {};
                  }
                }),
                s.createInvoke({ id: 'optional', src: optionalLogic })
              ]
            }
          }
        }
      }
    });
    const actor = createActor(machine).start();
    const children = actor.getSnapshot().children;
    expect(Object.keys(children).sort()).toEqual([
      'mappedUser',
      'optional',
      'staticUser'
    ]);
    await Promise.all([
      waitFor(children.staticUser!, (snapshot) => snapshot.status === 'done'),
      waitFor(children.mappedUser!, (snapshot) => snapshot.status === 'done'),
      waitFor(children.optional!, (snapshot) => snapshot.status === 'done')
    ]);
    expect(children.staticUser!.getSnapshot().output).toEqual({
      id: 1,
      name: 'static'
    });
    expect(children.mappedUser!.getSnapshot().output).toEqual({
      id: 7,
      name: 'mapped'
    });
    expect(children.optional!.getSnapshot().output).toBe('default');
    actor.stop();
  });

  it('falls back to setup context when hoisted and preserves extended sources', () => {
    const s = setup({
      schemas: { context: types<{ id: number | undefined }>() }
    }).extend({
      actions: { log: (name: string) => {} },
      states: { loading: { schemas: { context: types<{ id: number }>() } } }
    });
    const invoke = s.createInvoke({
      src: userLogic,
      input: ({ context }) => {
        expectTypeOf(context.id).toEqualTypeOf<number | undefined>();
        return { id: context.id ?? 0, label: 'David' };
      },
      onDone: ({ event, actions }, enq) => {
        expectTypeOf(event.output.name).toEqualTypeOf<string>();
        enq(actions.log, event.output.name);
        return {};
      }
    });
    expect(invoke.src).toBe(userLogic);
  });

  it('keeps state scope when extracting a state config by path', () => {
    const s = setup({
      schemas: { context: types<{ id: number | undefined }>() },
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
    const loading = s.createStateConfig('loading', {
      invoke: s.createInvoke({
        src: userLogic,
        input: ({ context, input }) => {
          expectTypeOf(context.id).toEqualTypeOf<number>();
          expectTypeOf(input.label).toEqualTypeOf<string>();
          return { id: context.id, label: input.label };
        },
        onDone: ({ event }) => {
          expectTypeOf(event.output.name).toEqualTypeOf<string>();
          return { target: 'ready' };
        }
      })
    });
    s.createMachine({
      context: { id: 7 },
      initial: { target: 'loading', input: { label: 'David' } },
      states: { loading, ready: {} }
    });
  });

  it('infers machine-level input in root invocations', () => {
    const s = setup({
      schemas: {
        context: types<{ id: number }>(),
        input: types<{ label: string }>()
      }
    });
    s.createMachine({
      context: { id: 7 },
      invoke: s.createInvoke({
        src: userLogic,
        input: ({ context, input }) => {
          expectTypeOf(input.label).toEqualTypeOf<string>();
          return { id: context.id, label: input.label };
        }
      })
    });
  });

  it('starts async work only when the actor runs and cancels it on state exit', () => {
    const s = setup({ schemas: { events: { cancel: types<{}>() } } });
    let signal: AbortSignal | undefined;
    const run = vi.fn((args: { signal: AbortSignal }) => {
      signal = args.signal;
      return new Promise<void>(() => {});
    });
    const machine = s.createMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: s.createInvoke({ src: createAsyncLogic({ run }) }),
          on: { cancel: { target: 'done' } }
        },
        done: {}
      }
    });
    initialTransition(machine);
    expect(run).not.toHaveBeenCalled();
    const actor = createActor(machine).start();
    expect(run).toHaveBeenCalledTimes(1);
    actor.send({ type: 'cancel' });
    expect(signal?.aborted).toBe(true);
    actor.stop();
  });
});
