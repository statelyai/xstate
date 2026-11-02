import { describe, expect, it } from 'vitest';
import { createActor, createMachine, matchesState } from 'xstate';
import { lowerActions } from '../src/transforms/lower-actions.ts';
import { applyTransform, normalize } from './helpers.ts';

const lower = (code: string) => applyTransform(lowerActions, code);

/** Wraps `on` transitions in a minimal machine. */
const machine = (on: string, extra = '', imports = 'createMachine') =>
  `import { ${imports} } from 'xstate';
const m = createMachine({
  ${extra}initial: 'a',
  states: {
    a: {
      on: {
        ${on}
      }
    },
    b: {}
  }
});`;

describe('lower-actions', () => {
  describe('v6 semantics the output relies on', () => {
    it('treats `return {}` as handled and `undefined` as unhandled', () => {
      const build = (inner: () => object | undefined) =>
        createActor(
          createMachine({
            initial: 'a',
            on: { E: () => ({ target: '.b' }) },
            states: { a: { on: { E: inner } }, b: {} }
          })
        ).start();
      const handled = build(() => ({}));
      handled.send({ type: 'E' });
      expect(handled.getSnapshot().value).toBe('a');
      const unhandled = build(() => undefined);
      unhandled.send({ type: 'E' });
      expect(unhandled.getSnapshot().value).toBe('b');
    });
  });

  describe('A. transitions', () => {
    it("returns only the patch, so parallel regions keep each other's updates", () => {
      // v6 evaluates both regions against the same context and merges the
      // returned patches; returning the whole context would undo region r1.
      const m = createMachine({
        type: 'parallel',
        context: { a: 0, b: 0 },
        states: {
          r1: { on: { E: () => ({ context: { a: 1 } }) } },
          r2: { on: { E: () => ({ context: { b: 1 } }) } }
        }
      });
      const actor = createActor(m).start();
      actor.send({ type: 'E' });
      expect(actor.getSnapshot().context).toEqual({ a: 1, b: 1 });
      const { output } = lower(
        machine(
          `E: { actions: [assign({ a: 1 }), assign({ b: 2 })] }`,
          '',
          'createMachine, assign'
        )
      );
      expect(output).toContain('return { context: patch };');
      expect(output).not.toContain('return { context };');
    });

    it('lowers target, guard, actions, reenter, meta and description', () => {
      const { output, changed } = lower(
        machine(
          `GO: { target: 'b', guard: 'ok', actions: 'track', reenter: true, meta: { x: 1 }, description: 'go' }`,
          `guards: { ok: ({ context }) => true },
  actions: { track: ({ event }) => console.log(event) },
  `
        )
      );
      expect(changed).toBe(true);
      expect(output).toContain(`// go
        GO: (args, enq) => {
          if (!args.guards.ok(args)) return;
          enq(args.actions.track, args);
          return { target: 'b', reenter: true, meta: { x: 1 } };
        }`);
    });

    it('leaves transitions without actions or guard as objects', () => {
      const input = machine(`GO: { target: 'b' }`);
      const { output, changed } = lower(input);
      expect(changed).toBe(false);
      expect(output).toBe(input);
    });

    it('returns {} for a targetless guarded transition with no effects', () => {
      const { output } = lower(
        machine(`GO: { guard: ({ context }) => context.ok }`)
      );
      expect(output).toContain(`GO: (args) => {
          const { context } = args;
          if (!context.ok) return;
          return {};
        }`);
    });

    it('omits the return when only effects are queued', () => {
      const { output } = lower(
        machine(`GO: { actions: () => console.log('x') }`)
      );
      expect(output).toContain(`GO: (args, enq) => {
          enq(() => console.log('x'));
        }`);
    });

    it('omits unused parameters of generated functions', () => {
      const { output } = lower(
        machine(
          `GO: { guard: () => true, target: 'b' }, X: { guard: ({ context }) => context.ok }`
        )
      );
      expect(output).toContain(`GO: () => {`);
      expect(output).toContain(`X: (args) => {`);
      expect(lower(output).changed).toBe(false);
    });

    it('collapses unguarded transition arrays to their first candidate', () => {
      const { output, notes } = lower(
        machine(`GO: [{ target: 'b' }, { target: 'a' }], X: ['b']`)
      );
      expect(output).toContain(`GO: { target: 'b' }, X: 'b'`);
      expect(notes.join('\n')).toContain('never reaches the other 1');
      expect(lower(output).changed).toBe(false);
    });

    it('turns transition arrays into an if-chain and drops unreachable candidates', () => {
      const { output, notes } = lower(
        machine(
          `GO: [
          { guard: ({ context }) => context.n > 1, target: 'b', actions: assign({ n: 0 }) },
          { target: 'a', actions: raise({ type: 'X' }) },
          { target: 'b' }
        ]`,
          'context: { n: 0 },\n  ',
          'createMachine, assign, raise'
        )
      );
      expect(output).toContain(`GO: (args, enq) => {
          const { context } = args;
          if (context.n > 1) {
            return { target: 'b', context: { n: 0 } };
          }
          enq.raise({ type: 'X' });
          return { target: 'a' };
        }`);
      expect(notes.join('\n')).toContain('unreachable');
      expect(output).toContain(`import { createMachine } from 'xstate';`);
    });

    it('lowers after, always, onDone and invoke transitions', () => {
      const { output } = lower(`import { createMachine, raise } from 'xstate';
const m = createMachine({
  states: {
    a: {
      after: { 100: { target: 'b', actions: raise({ type: 'T' }) } },
      always: { guard: () => false, target: 'b' },
      onDone: { actions: raise({ type: 'D' }) },
      invoke: { src: 'x', onDone: { target: 'b', actions: raise({ type: 'Y' }) } }
    }
  }
});`);
      expect(output).not.toContain('actions:');
      expect(output).not.toContain('guard:');
      expect(output).toContain(`100: (args, enq) => {`);
      expect(output).toContain(`always: () => {
        if (!false) return;
        return { target: 'b' };
      }`);
      expect(output).toContain(`onDone: (args, enq) => {
        enq.raise({ type: 'D' });
      }`);
      expect(output).toContain(`enq.raise({ type: 'Y' });`);
    });

    it('does not lower unknown keys or cond', () => {
      const input = machine(
        `GO: { target: 'b', actions: () => {}, internal: true },
        GO2: { target: 'b', cond: 'x' }`
      );
      const { output, changed, notes } = lower(input);
      expect(changed).toBe(false);
      expect(output).toBe(input);
      expect(notes.join('\n')).toContain(
        "unsupported transition key 'internal: true'"
      );
      expect(notes.join('\n')).toContain('`cond`');
    });
  });

  describe('B. guards', () => {
    const guards = `guards: { a: ({ context }) => context.a, b: (_, params) => params.b },
  `;
    it.each([
      [`'a'`, `if (!args.guards.a(args)) return;`],
      [
        `{ type: 'b', params: { b: 1 } }`,
        `if (!args.guards.b(args, { b: 1 })) return;`
      ],
      [
        `{ type: 'b', params: ({ context }) => ({ b: context.b }) }`,
        `if (!args.guards.b(args, ({ b: context.b }))) return;`
      ],
      [
        `and(['a', or([{ type: 'b' }, ({ event }) => event.x > 1])])`,
        `if (!(args.guards.a(args) && (args.guards.b(args) || (event.x > 1)))) return;`
      ],
      [`not('a')`, `if (!!args.guards.a(args)) return;`],
      [
        `stateIn({ a: 'x' })`,
        `if (!matchesState({ a: 'x' }, args.value)) return;`
      ],
      [`isBig`, `if (!isBig(args)) return;`],
      [
        `function (args) { return true; }`,
        `if (!(function (args) { return true; })(args)) return;`
      ]
    ])('%s', (guard, expected) => {
      const { output } = lower(
        `const isBig = ({ context }) => context.n > 10;\n` +
          machine(
            `GO: { target: 'b', guard: ${guard} }`,
            guards,
            'createMachine, and, or, not, stateIn'
          )
      );
      expect(output).toContain(expected);
    });

    it('imports matchesState and drops the combinator imports', () => {
      const { output } = lower(
        machine(
          `GO: { target: 'b', guard: and([stateIn('a'), not(() => false)]) }`,
          '',
          'createMachine, and, not, stateIn'
        )
      );
      expect(output).toContain(
        `import { createMachine, matchesState } from 'xstate';`
      );
    });

    it('does not lower undefined named guards, stateIn ids or unknown identifiers', () => {
      for (const guard of [`'missing'`, `stateIn('#id')`, `someImported`]) {
        const input = `import { someImported } from './x';\n${machine(
          `GO: { target: 'b', guard: ${guard} }`,
          '',
          'createMachine, stateIn'
        )}`;
        const { changed } = lower(input);
        expect(changed, guard).toBe(false);
      }
    });
  });

  describe('C. actions', () => {
    const actions = `actions: { track: ({ event }) => console.log(event) },
  `;
    it.each([
      [`'track'`, `enq(args.actions.track, args);`],
      [
        `{ type: 'track', params: ({ event }) => ({ id: event.id }) }`,
        `enq(args.actions.track, args, ({ id: event.id }));`
      ],
      [`({ event }) => console.log(event)`, `enq(() => console.log(event));`],
      [
        `({ event }) => { console.log(event); }`,
        `enq(({ event }) => { console.log(event); }, args);`
      ],
      [
        `raise({ type: 'X' }, { delay: 10, id: 'r' })`,
        `enq.raise({ type: 'X' }, { delay: 10, id: 'r' });`
      ],
      [
        `raise(({ event }) => ({ type: event.next }))`,
        `enq.raise(({ type: event.next }));`
      ],
      [`sendTo('child', { type: 'X' })`, `enq.sendTo('child', { type: 'X' });`],
      [
        `sendTo(({ context }) => context.ref, { type: 'X' }, { delay: 5 })`,
        `enq.sendTo(context.ref, { type: 'X' }, { delay: 5 });`
      ],
      [
        `sendParent({ type: 'UP' })`,
        `enq.sendTo(args.parent, { type: 'UP' });`
      ],
      [`forwardTo('child')`, `enq.sendTo('child', args.event);`],
      [`emit({ type: 'E' })`, `enq.emit({ type: 'E' });`],
      [`log('hi')`, `enq.log('hi');`],
      [
        `log(({ event }) => event.type, 'label')`,
        `enq.log('label', event.type);`
      ],
      [`log()`, `enq.log({ context: args.context, event: args.event });`],
      [`cancel('r')`, `enq.cancel('r');`],
      [`stopChild('child')`, `enq.stop(args.children['child']);`],
      [`stopChild(({ context }) => context.ref)`, `enq.stop(context.ref);`],
      [
        `spawnChild('worker', { id: 'w', input: ({ context }) => context.n })`,
        `enq.spawn('worker', { id: 'w', input: context.n });`
      ]
    ])('%s', (action, expected) => {
      const { output } = lower(
        machine(
          `GO: { actions: ${action} }`,
          actions,
          'createMachine, raise, sendTo, sendParent, forwardTo, emit, log, cancel, stopChild, spawnChild'
        )
      );
      expect(output).toContain(expected);
      expect(output).toContain(`import { createMachine } from 'xstate';`);
    });

    it('threads assigned context through later actions', () => {
      const { output } = lower(
        machine(
          `GO: { target: 'b', actions: [
          ({ context }) => console.log(context),
          assign({ n: ({ context }) => context.n + 1, fixed: 'x' }),
          assign(({ context, event }) => ({ m: context.n * event.k })),
          'track',
          ({ context }) => console.log(context),
          raise(({ context }) => ({ type: 'N', n: context.n }))
        ] }`,
          actions,
          'createMachine, assign, raise'
        )
      );
      expect(output).toContain(`GO: (args, enq) => {
          const { event } = args;
          let context = args.context;
          let patch = {};
          enq(({ context }) => console.log(context), args);
          patch = { ...patch, n: context.n + 1, fixed: 'x' };
          context = { ...args.context, ...patch };
          patch = { ...patch, m: context.n * event.k };
          context = { ...args.context, ...patch };
          enq(args.actions.track, { ...args, context });
          enq(() => console.log(context));
          enq.raise(({ type: 'N', n: context.n }));
          return { target: 'b', context: patch };
        }`);
    });

    it('passes spawn to assigners that use it', () => {
      const { output } = lower(
        machine(
          `GO: { actions: assign({ ref: ({ spawn }) => spawn('child') }) }`,
          '',
          'createMachine, assign'
        )
      );
      expect(output).toContain(
        `return { context: { ref: (({ spawn }) => spawn('child'))({ ...args, spawn: enq.spawn }) } };`
      );
    });

    it('does not lower enqueueActions, unknown calls or undefined named actions', () => {
      for (const action of [
        `enqueueActions(({ enqueue }) => enqueue('x'))`,
        `helper()`,
        `'missing'`,
        `sendTo('#system', { type: 'X' })`
      ]) {
        const input = machine(
          `GO: { actions: ${action} }`,
          '',
          'createMachine, enqueueActions, sendTo'
        );
        const { changed, notes } = lower(input);
        expect(changed, action).toBe(false);
        expect(notes.join('\n')).toContain('not lowered');
      }
    });
  });

  describe('D. inlining', () => {
    it('uses the call form when the transition references an outer `event`', () => {
      const { output } = lower(
        `const event = { type: 'X' };\n` +
          machine(
            `GO: { actions: [({ self }) => self.send(event), raise(event)] }`,
            '',
            'createMachine, raise'
          )
      );
      expect(output).toContain(`enq(({ self }) => self.send(event), args);`);
      expect(output).toContain(`enq.raise(event);`);
    });

    it('does not lower when the transition references an outer `args` or `context`', () => {
      const input =
        `const context = {};\n` +
        machine(`GO: { actions: () => console.log(context) }`);
      expect(lower(input).changed).toBe(false);
    });
  });

  describe('E. entry and exit', () => {
    it('lowers lists and returns the assigned context', () => {
      const { output } = lower(`import { createMachine, assign } from 'xstate';
const m = createMachine({
  context: { n: 0 },
  entry: [assign({ n: 1 }), 'track'],
  exit: 'track',
  actions: { track: ({ context }) => console.log(context) }
});`);
      expect(output).toContain(`entry: (args, enq) => {
    let context = args.context;
    let patch = {};
    patch = { ...patch, n: 1 };
    context = { ...args.context, ...patch };
    enq(args.actions.track, { ...args, context });
    return { context: patch };
  },
  exit: (args, enq) => {
    enq(args.actions.track, args);
  },`);
    });

    it('leaves function entry/exit alone', () => {
      const input = `import { createMachine } from 'xstate';
const m = createMachine({ entry: (_, enq) => enq(() => {}) });`;
      expect(lower(input).changed).toBe(false);
    });
  });

  describe('F. named implementations', () => {
    it('moves a literal second argument into the config', () => {
      const { output, notes } = lower(`import { createMachine } from 'xstate';
const m = createMachine(
  {
    actions: { a: () => {} },
    on: { GO: { actions: ['a', 'b'] } }
  },
  {
    actions: { b: () => {} },
    guards: { g: () => true }
  }
);`);
      expect(normalize(output)).toBe(
        normalize(`import { createMachine } from 'xstate';
const m = createMachine(
  {
    actions: { a: () => {},
    b: () => {} },
    on: { GO: (args, enq) => {
      enq(args.actions.a, args);
      enq(args.actions.b, args);
    } },
    guards: { g: () => true }
  }
);`)
      );
      expect(notes.join('\n')).toContain(
        'moved the second createMachine argument'
      );
    });

    it('leaves a non-literal second argument', () => {
      const input = `import { createMachine } from 'xstate';
const m = createMachine({ on: { GO: { target: '.a' } } }, impls);`;
      const { changed, notes } = lower(input);
      expect(changed).toBe(false);
      expect(notes.join('\n')).toContain('not an object literal');
    });

    it('rewrites named assign actions to patch functions and their call sites', () => {
      const { output } = lower(`import { setup, assign } from 'xstate';
const m = setup({
  actions: {
    inc: assign({ n: ({ context }) => context.n + 1, label: 'x' }),
    set: assign(({ event }, params) => ({ n: params.n ?? event.n })),
    mixed: assign({ n: (_, params) => params.n })
  }
}).createMachine({
  context: { n: 0 },
  on: { GO: { actions: ['inc', { type: 'set', params: { n: 2 } }] } }
});`);
      expect(output).toContain(
        `inc: ({ context }) => ({ n: context.n + 1, label: 'x' }),`
      );
      expect(output).toContain(
        `set: ({ event }, params) => ({ n: params.n ?? event.n }),`
      );
      expect(output).toContain(
        `mixed: (args, params) => ({ n: ((_, params) => params.n)(args, params) })`
      );
      expect(output).toContain(`GO: (args) => {
    let context = args.context;
    let patch = {};
    patch = { ...patch, ...args.actions.inc(args) };
    context = { ...args.context, ...patch };
    patch = { ...patch, ...args.actions.set({ ...args, context }, { n: 2 }) };
    context = { ...args.context, ...patch };
    return { context: patch };
  }`);
      expect(output).toContain(`import { setup } from 'xstate';`);
    });

    it('resolves shorthand implementations declared in the file', () => {
      const { output } = lower(`import { setup } from 'xstate';
const isOk = ({ context }) => context.ok;
function track() {}
const m = setup({ guards: { isOk }, actions: { track } }).createMachine({
  on: { GO: { guard: 'isOk', actions: 'track' } }
});`);
      expect(output).toContain(`if (!args.guards.isOk(args)) return;
    enq(args.actions.track, args);`);
    });

    it('does not lower sites that use a named action creator', () => {
      const input = `import { setup, raise } from 'xstate';
const m = setup({ actions: { go: raise({ type: 'X' }) } }).createMachine({
  on: { GO: { actions: 'go' } }
});`;
      const { changed, notes } = lower(input);
      expect(changed).toBe(false);
      expect(notes.join('\n')).toContain(
        "action 'go' is not a plain function or assign"
      );
    });

    it('lowers fromPromise without system or emit', () => {
      const { output } = lower(`import { setup, fromPromise } from 'xstate';
const load = fromPromise(async ({ input }) => input.id);
const keep = fromPromise(async ({ input, system }) => system.get(input));
export const m = setup({ actors: { load, keep } }).createMachine({});`);
      expect(output).toContain(
        `const load = createAsyncLogic({ run: async ({ input }) => input.id });`
      );
      expect(output).toContain(`const keep = fromPromise(`);
      expect(output).toContain(
        `import { setup, fromPromise, createAsyncLogic } from 'xstate';`
      );
    });
  });

  describe('P4. constant names', () => {
    it('resolves enum and const-object computed keys for named implementations', () => {
      const { output } = lower(`import { setup } from 'xstate';
enum Guards { Ok = 'ok' }
const Actions = { Track: 'track' } as const;
const m = setup({
  guards: { [Guards.Ok]: () => true },
  actions: { [Actions.Track]: () => {} }
}).createMachine({
  on: { GO: { guard: Guards.Ok, actions: [Actions.Track, { type: Actions.Track, params: { a: 1 } }] } }
});`);
      expect(output).toContain('if (!args.guards[Guards.Ok](args)) return;');
      expect(output).toContain('enq(args.actions[Actions.Track], args);');
      expect(output).toContain(
        'enq(args.actions[Actions.Track], args, { a: 1 });'
      );
      expect(output).toContain('[Guards.Ok]: () => true');
    });

    it('leaves non-constant computed names alone', () => {
      const { changed } = lower(`import { setup } from 'xstate';
let Guards = { Ok: 'ok' };
const m = setup({ guards: { [Guards.Ok]: () => true } }).createMachine({
  on: { GO: { guard: Guards.Ok } }
});`);
      expect(changed).toBe(false);
    });
  });

  describe('P3. combinator guard definitions', () => {
    it('inlines a named combinator guard and deletes the definition', () => {
      const { output } =
        lower(`import { setup, not, stateIn, and } from 'xstate';
const m = setup({
  guards: {
    ok: ({ context }) => context.ok,
    editable: not(stateIn('locked')),
    both: and(['ok', 'editable'])
  }
}).createMachine({
  on: { GO: { guard: 'both', target: '.b' }, X: { guard: 'editable', target: '.b' } }
});`);
      expect(output).toContain(
        "if (!(args.guards.ok(args) && !matchesState('locked', args.value))) return;"
      );
      expect(output).toContain(
        "if (!!matchesState('locked', args.value)) return;"
      );
      expect(output).not.toContain('editable:');
      expect(output).not.toContain('both:');
      expect(output).toContain('ok: ({ context }) => context.ok');
      expect(output).toContain("import { setup, matchesState } from 'xstate';");
      expect(lower(output).changed).toBe(false);
    });

    it('keeps the definition when a reference was not lowered', () => {
      const { output, notes } =
        lower(`import { setup, not, stateIn } from 'xstate';
const m = setup({
  guards: { editable: not(stateIn('locked')) }
}).createMachine({
  on: { GO: { guard: 'editable', target: '.b' }, X: { guard: 'editable', unknown: 1 } }
});`);
      expect(output).toContain("editable: not(stateIn('locked'))");
      expect(output).toContain(
        "if (!!matchesState('locked', args.value)) return;"
      );
      expect(notes.join('\n')).toContain("kept 'editable'");
    });

    it('behaves like v5 for the inlined guard', () => {
      const m = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: (args) =>
                matchesState('a', args.value) ? { target: 'b' } : undefined
            }
          },
          b: {}
        }
      });
      const actor = createActor(m).start();
      actor.send({ type: 'GO' });
      expect(actor.getSnapshot().value).toBe('b');
    });
  });

  describe('G. imports and idempotence', () => {
    it('keeps imports still referenced elsewhere', () => {
      const { output } = lower(
        `export const reset = assign({ n: 0 });\n` +
          machine(
            `GO: { actions: assign({ n: 1 }) }`,
            '',
            'createMachine, assign'
          )
      );
      expect(output).toContain(
        `import { createMachine, assign } from 'xstate';`
      );
    });

    it('changes nothing on a second run', () => {
      const input = `import { setup, assign, raise, and, stateIn, fromPromise } from 'xstate';
const m = setup({
  actions: { inc: assign({ n: ({ context }) => context.n + 1 }), track: () => {} },
  guards: { ok: () => true },
  actors: { load: fromPromise(async () => 1) }
}).createMachine({
  context: { n: 0 },
  entry: ['inc', raise({ type: 'GO' })],
  initial: 'a',
  states: {
    a: {
      on: {
        GO: [
          { guard: and(['ok', stateIn('a')]), target: 'b', actions: 'inc', description: 'first' },
          { target: 'a', actions: 'track' }
        ]
      }
    },
    b: {}
  }
});`;
      const once = lower(input).output;
      const twice = lower(once);
      expect(twice.changed).toBe(false);
      expect(twice.output).toBe(once);
      expect(once).toContain(
        `import { setup, createAsyncLogic, matchesState } from 'xstate';`
      );
      expect(once).toContain(`          // first\n`);
    });
  });
});
