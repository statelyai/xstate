import { Context, Effect, Schema } from 'effect';
import { types, type AnyActorRef } from 'xstate';
import { setupEffect, type RequirementsFrom } from './index.ts';

type IsAny<T> = 0 extends 1 & T ? true : false;
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

it('infers decoded context and discriminated public and internal events', () => {
  setupEffect({
    schemas: {
      context: Schema.Struct({ count: Schema.NumberFromString }),
      events: {
        ADD: Schema.Struct({ amount: Schema.Number }),
        RESET: types<{ reason?: string }>()
      },
      internalEvents: { tick: Schema.Struct({ elapsed: Schema.Number }) }
    },
    actions: {
      audit: ({ context, event }) => {
        false satisfies IsAny<typeof context>;
        false satisfies IsAny<typeof context.count>;
        false satisfies IsAny<typeof event>;
        true satisfies Equals<typeof context, { readonly count: number }>;
        // @ts-expect-error -- count is decoded to a number
        context.count.toUpperCase();
        true satisfies Equals<typeof event.type, 'ADD' | 'RESET' | 'tick'>;
        if (event.type === 'ADD') {
          true satisfies Equals<typeof event.amount, number>;
          // @ts-expect-error -- only ADD carries an amount
          event.reason;
        } else if (event.type === 'RESET') {
          true satisfies Equals<typeof event.reason, string | undefined>;
        } else {
          true satisfies Equals<typeof event.elapsed, number>;
          // @ts-expect-error -- elapsed is numeric
          event.elapsed.toUpperCase();
        }
        return Effect.void;
      }
    }
  });
});

it('uses safe defaults when setup does not declare schemas', () => {
  setupEffect({
    actions: {
      audit: ({ context, event }) => {
        false satisfies IsAny<typeof context>;
        false satisfies IsAny<typeof event>;
        true satisfies Equals<typeof context.count, unknown>;
        true satisfies Equals<typeof event, { type: string }>;
        // @ts-expect-error -- machine configuration cannot type earlier actions
        context.count.toFixed();
        // @ts-expect-error -- no event payload was declared
        event.amount;
        return Effect.void;
      }
    }
  });
});

it('uses merged extension schemas and their replacements for all source maps', () => {
  const base = setupEffect({
    schemas: {
      context: types<{ count: number }>(),
      events: { ADD: types<{ amount: number }>() },
      internalEvents: { tick: types<{ elapsed: number }>() }
    }
  });
  base.extend({
    schemas: { events: { RESET: Schema.Struct({ reason: Schema.String }) } },
    actions: {
      inherited: ({ context, event }) => {
        false satisfies IsAny<typeof context>;
        false satisfies IsAny<typeof event>;
        true satisfies Equals<typeof context.count, number>;
        true satisfies Equals<typeof event.type, 'ADD' | 'RESET' | 'tick'>;
        if (event.type === 'ADD') {
          // @ts-expect-error -- inherited payload remains numeric
          event.amount.toUpperCase();
        }
        return Effect.void;
      }
    },
    guards: {
      valid: (count: number) => count > 0
    },
    delays: {
      retry: ({ context, event }) => {
        false satisfies IsAny<typeof context>;
        event.type satisfies 'ADD' | 'RESET' | 'tick';
        return context.count;
      }
    }
  });
  base.extend({
    schemas: {
      context: Schema.Struct({ label: Schema.String }),
      events: { ADD: Schema.Struct({ amount: Schema.String }) },
      internalEvents: { tick: types<{ elapsed: string }>() }
    },
    actions: {
      replaced: ({ context, event }) => {
        true satisfies Equals<typeof context, { readonly label: string }>;
        // @ts-expect-error -- context schemas replace the previous context
        context.count;
        if (event.type === 'ADD') {
          true satisfies Equals<typeof event.amount, string>;
          // @ts-expect-error -- the replacement payload is a string
          event.amount.toFixed();
        } else {
          true satisfies Equals<typeof event.elapsed, string>;
        }
        return Effect.void;
      }
    }
  });
});

it('treats an action params schema as its entire hosted argument', () => {
  const machine = setupEffect({
    schemas: {
      context: Schema.Struct({ count: Schema.Number }),
      events: { GO: types<{}>() },
      actions: {
        audit: { params: types<{ message: string }>() },
        annotated: { params: types<{ message: string }>() },
        noArgs: { params: types<{ message: string }>() }
      }
    },
    actions: {
      audit: (args) => {
        false satisfies IsAny<typeof args>;
        true satisfies Equals<typeof args.message, string>;
        args.self satisfies AnyActorRef;
        // @ts-expect-error -- params describe the whole argument
        args.params;
        // @ts-expect-error -- message is a string
        args.message.toFixed();
        return Effect.void;
      },
      annotated: (args: { message: string }) => Effect.log(args.message),
      noArgs: () => Effect.void,
      inferred: ({ context, event }) => {
        false satisfies IsAny<typeof context.count>;
        true satisfies Equals<typeof event.type, 'GO'>;
        // @ts-expect-error -- inferred and annotated callbacks can coexist
        context.count.toUpperCase();
        return Effect.void;
      },
      selfOnly: (_args: { self: AnyActorRef }) => Effect.void
    }
  }).createMachine({
    context: { count: 0 },
    on: {
      GO: (args, enq) => {
        enq(args.actions.audit, { self: args.self, message: 'saved' });
        // @ts-expect-error -- hosted Effect actions require the owning actor
        enq(args.actions.audit, { message: 'saved' });
        // @ts-expect-error -- declared action payloads are checked
        enq(args.actions.audit, { self: args.self, message: 42 });
        enq(args.actions.annotated, { self: args.self, message: 'saved' });
        // @ts-expect-error -- annotations cannot remove the hosting argument
        enq(args.actions.annotated, { message: 'saved' });
        // @ts-expect-error -- a no-argument implementation still needs hosting
        enq(args.actions.noArgs);
        enq(args.actions.noArgs, { self: args.self, message: 'saved' });
      }
    }
  });
  void machine;
});

it('merges and overrides per-action argument schemas in extensions', () => {
  setupEffect({
    schemas: {
      actions: {
        inherited: { params: types<{ label: string }>() },
        replaced: { params: types<{ count: number }>() }
      }
    }
  }).extend({
    schemas: {
      actions: { replaced: { params: Schema.Struct({ count: Schema.String }) } }
    },
    actions: {
      inherited: ({ label, self }) => {
        false satisfies IsAny<typeof label>;
        label.toUpperCase();
        self satisfies AnyActorRef;
        return Effect.void;
      },
      replaced: ({ count }) => {
        true satisfies Equals<typeof count, string>;
        // @ts-expect-error -- the extension replaces this action schema
        count.toFixed();
        return Effect.void;
      }
    }
  });
});

it('preserves annotated arguments and their individual service requirements', () => {
  const Audit = Context.Service<{ record: Effect.Effect<void> }>('Audit');
  const Backup = Context.Service<{ save: Effect.Effect<void> }>('Backup');
  const audit = Audit.use((service) => service.record);
  const backup = Backup.use((service) => service.save);
  type Requirements<T> =
    T extends Effect.Effect<unknown, unknown, infer R> ? R : never;
  const base = setupEffect({
    actions: {
      audit: (args: { context: { label: string }; self: AnyActorRef }) => {
        args.context.label.toUpperCase();
        return audit;
      }
    }
  });
  const machine = base.createMachine({
    context: { label: 'saved' },
    on: {
      GO: (args, enq) => {
        enq(args.actions.audit, {
          self: args.self,
          context: { label: 'saved' }
        });
        // @ts-expect-error -- the explicit argument annotation is preserved
        enq(args.actions.audit, { self: args.self, context: { label: 1 } });
      }
    }
  });
  true satisfies Equals<
    RequirementsFrom<typeof machine>,
    Requirements<typeof audit>
  >;
  const replaced = machine.provide({ actions: { audit: () => backup } });
  true satisfies Equals<
    RequirementsFrom<typeof replaced>,
    Requirements<typeof backup>
  >;
  const plain = replaced.provide({ actions: { audit: () => {} } });
  true satisfies Equals<RequirementsFrom<typeof plain>, never>;
  const extended = base
    .extend({
      actions: {
        save: (args: { context: { count: number }; self: AnyActorRef }) => {
          args.context.count.toFixed();
          return backup;
        }
      }
    })
    .createMachine({});
  true satisfies Equals<
    RequirementsFrom<typeof extended>,
    Requirements<typeof audit> | Requirements<typeof backup>
  >;
});

it('rejects non-Effect declared actions', () => {
  // @ts-expect-error -- declared actions must return an Effect
  setupEffect({ actions: { invalid: () => 42 } });
  // @ts-expect-error -- asynchronous functions must wrap their work in an Effect
  setupEffect({ actions: { invalid: async () => {} } });
});

it('does not let the annotation fallback override an action argument schema', () => {
  const schemas = {
    actions: { audit: { params: types<{ message: string }>() } }
  };
  const actions = {
    audit: (_args: { context: { count: number }; self: AnyActorRef }) =>
      Effect.void
  };
  // @ts-expect-error -- the action does not accept its declared argument
  setupEffect({ schemas, actions });
});
