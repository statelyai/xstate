import {
  createActor,
  createMachine,
  setup,
  types,
  type ActorRef,
  type Snapshot
} from '../src/index.ts';

function expectType<T>(_value: T) {}

type Emitted = { type: 'BAR'; value: number } | { type: 'BAZ'; label: string };
type ParentRef = ActorRef<Snapshot<unknown>, { type: 'FOO' }, Emitted>;

function checkSelf(self: ParentRef) {
  self.on('BAR', (event) => {
    expectType<number>(event.value);
    // @ts-expect-error BAR has no label
    event.label;
  });
  self.on('*', (event) => {
    if (event.type === 'BAZ') expectType<string>(event.label);
  });
  // @ts-expect-error undeclared emitted event
  self.on('UNKNOWN', () => {});
}

const schemas = {
  events: { FOO: types<{}>() },
  internalEvents: { INTERNAL: types<{}>() },
  emitted: { BAR: types<{ value: number }>(), BAZ: types<{ label: string }>() },
  context: types<{ count: number }>()
};

const child = createMachine({
  schemas: { input: types<{ parent: ParentRef }>() },
  context: ({ input }) => {
    checkSelf(input.parent);
    return {};
  }
});

describe('emitted events on machine self (#4836)', () => {
  it('setup retains emitted events across callback types', () => {
    const machine = setup({ schemas, actors: { child } }).createMachine({
      context: ({ self, spawn, actors }) => {
        checkSelf(self);
        self.on('BAR', (event) => expectType<number>(event.value));
        // @ts-expect-error undeclared emitted event
        self.on('UNKNOWN', () => {});
        spawn(actors.child, { input: { parent: self } });
        return { count: 0 };
      },
      entry: ({ self }, enq) => {
        checkSelf(self);
        self.on('BAR', (event) => expectType<number>(event.value));
        // @ts-expect-error undeclared emitted event
        self.on('UNKNOWN', () => {});
        enq.emit({ type: 'BAR', value: 1 });
        // @ts-expect-error emitted payload must match its schema
        enq.emit({ type: 'BAR', value: 'wrong' });
        // @ts-expect-error undeclared emission
        enq.emit({ type: 'UNKNOWN' });
      },
      exit: ({ self }) => {
        checkSelf(self);
      },
      invoke: {
        src: 'child',
        input: ({ self }) => ({ parent: self }),
        onDone: ({ self }) => {
          checkSelf(self);
        }
      },
      on: {
        FOO: ({ self }) => {
          checkSelf(self);
          // @ts-expect-error undeclared emitted event
          self.on('UNKNOWN', () => {});
          // @ts-expect-error emitted events are not sendable
          self.send({ type: 'BAR', value: 1 });
        },
        INTERNAL: {
          context: ({ self }) => {
            checkSelf(self);
            return { count: 1 };
          }
        }
      },
      always: ({ self }) => {
        checkSelf(self);
      },
      after: {
        100: {
          context: ({ self }) => {
            checkSelf(self);
            return { count: 2 };
          }
        }
      },
      output: ({ self }) => {
        checkSelf(self);
        return 1;
      },
      initial: 'waiting',
      states: {
        waiting: {
          route: ({ self }) => {
            checkSelf(self);
            return true;
          }
        },
        choose: {
          type: 'choice',
          choice: ({ self }) => {
            checkSelf(self);
            return { target: 'waiting' };
          }
        },
        done: {
          type: 'final',
          output: ({ self }) => {
            checkSelf(self);
            return 1;
          }
        }
      }
    });
    const actor = createActor(machine);
    checkSelf(actor);
    actor.send({ type: 'FOO' });
    // @ts-expect-error internal events remain unavailable on public actor refs
    actor.send({ type: 'INTERNAL' });
    // @ts-expect-error emitted events are not sendable
    actor.send({ type: 'BAR', value: 1 });
  });
  it('createMachine retains emitted events across callback types', () => {
    const machine = createMachine({
      schemas,
      actors: { child },
      context: ({ self, spawn, actors }) => {
        checkSelf(self);
        self.on('BAR', (event) => expectType<number>(event.value));
        // @ts-expect-error undeclared emitted event
        self.on('UNKNOWN', () => {});
        spawn(actors.child, { input: { parent: self } });
        return { count: 0 };
      },
      entry: ({ self }, enq) => {
        checkSelf(self);
        self.on('BAR', (event) => expectType<number>(event.value));
        // @ts-expect-error undeclared emitted event
        self.on('UNKNOWN', () => {});
        enq.emit({ type: 'BAR', value: 1 });
        // @ts-expect-error emitted payload must match its schema
        enq.emit({ type: 'BAR', value: 'wrong' });
        // @ts-expect-error undeclared emission
        enq.emit({ type: 'UNKNOWN' });
      },
      exit: ({ self }) => {
        checkSelf(self);
      },
      invoke: {
        src: 'child',
        input: ({ self }) => ({ parent: self }),
        onDone: ({ self }) => {
          checkSelf(self);
        }
      },
      on: {
        FOO: ({ self }) => {
          checkSelf(self);
          // @ts-expect-error undeclared emitted event
          self.on('UNKNOWN', () => {});
          // @ts-expect-error emitted events are not sendable
          self.send({ type: 'BAR', value: 1 });
        },
        INTERNAL: {
          context: ({ self }) => {
            checkSelf(self);
            return { count: 1 };
          }
        }
      },
      always: ({ self }) => {
        checkSelf(self);
      },
      after: {
        100: {
          context: ({ self }) => {
            checkSelf(self);
            return { count: 2 };
          }
        }
      },
      output: ({ self }) => {
        checkSelf(self);
        return 1;
      },
      initial: 'waiting',
      states: {
        waiting: {
          route: ({ self }) => {
            checkSelf(self);
            return true;
          }
        },
        choose: {
          type: 'choice',
          choice: ({ self }) => {
            checkSelf(self);
            return { target: 'waiting' };
          }
        },
        done: {
          type: 'final',
          output: ({ self }) => {
            checkSelf(self);
            return 1;
          }
        }
      }
    });
    const actor = createActor(machine);
    checkSelf(actor);
    actor.send({ type: 'FOO' });
    // @ts-expect-error internal events remain unavailable on public actor refs
    actor.send({ type: 'INTERNAL' });
    // @ts-expect-error emitted events are not sendable
    actor.send({ type: 'BAR', value: 1 });
  });
  it('types self without a declared context schema', () => {
    const { context: _context, ...inferredSchemas } = schemas;
    const machine = createMachine({
      schemas: inferredSchemas,
      context: ({ self }) => {
        checkSelf(self);
        // @ts-expect-error undeclared emitted event
        self.on('UNKNOWN', () => {});
        return { count: 0 };
      },
      entry: ({ context, self }) => {
        expectType<number>(context.count);
        checkSelf(self);
      }
    });
    expectType<number>(createActor(machine).getSnapshot().context.count);
  });

  it('preserves permissive emissions when no emitted schema is declared', () => {
    createMachine({
      entry: ({ self }) => {
        self.on('anything', () => {});
      }
    });
    setup({}).createMachine({
      entry: ({ self }) => {
        self.on('anything', () => {});
      }
    });
  });

  it('preserves untyped listener payloads during context initialization', () => {
    createMachine({
      context: ({ self }) => {
        self.on('progress', (event) => expectType<number>(event.percent));
        return {};
      }
    });
    createMachine({
      schemas: { context: types<{}>() },
      context: ({ self }) => {
        self.on('progress', (event) => expectType<number>(event.percent));
        return {};
      }
    });
    setup({}).createMachine({
      context: ({ self }) => {
        self.on('progress', (event) => expectType<number>(event.percent));
        return {};
      }
    });
    setup({ schemas: { context: types<{}>() } }).createMachine({
      context: ({ self }) => {
        self.on('progress', (event) => expectType<number>(event.percent));
        return {};
      }
    });
  });

  it('preserves untyped listener payloads in output mappers', () => {
    createMachine({
      output: ({ self }) => {
        self.on('progress', (event) => expectType<number>(event.percent));
        return {};
      }
    });
    setup({}).createMachine({
      output: ({ self }) => {
        self.on('progress', (event) => expectType<number>(event.percent));
        return {};
      }
    });
  });

  it('rejects listeners during context initialization for an empty emitted schema', () => {
    createMachine({
      schemas: { emitted: {} },
      context: ({ self }) => {
        // @ts-expect-error no emitted names are declared
        self.on('progress', () => {});
        self.on('*', (event) => expectType<never>(event));
        return {};
      }
    });
    setup({ schemas: { emitted: {} } }).createMachine({
      context: ({ self }) => {
        // @ts-expect-error no emitted names are declared
        self.on('progress', () => {});
        self.on('*', (event) => expectType<never>(event));
        return {};
      }
    });
  });

  it('rejects named listeners for an empty emitted schema', () => {
    setup({ schemas: { emitted: {} } }).createMachine({
      entry: ({ self }) => {
        // @ts-expect-error no emitted names are declared
        self.on('BAR', () => {});
        self.on('*', (event) => expectType<never>(event));
      }
    });
  });
});
