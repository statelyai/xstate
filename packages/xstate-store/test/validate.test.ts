import { createStore } from '../src/index.ts';
import { reset } from '../src/reset.ts';
import { StoreValidationError, validateSchemas } from '../src/validate.ts';
import { z } from 'zod';

function getThrown(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
}

it('validates initial context when the extension is applied', () => {
  expect(() =>
    createStore({
      schemas: {
        context: z.object({ count: z.number() })
      },
      context: { count: 'nope' } as any,
      on: {}
    }).with(validateSchemas())
  ).toThrow(StoreValidationError);
});

it('validates event payloads before transitions', () => {
  const store = createStore({
    schemas: {
      events: {
        inc: z.object({ by: z.number() })
      }
    },
    context: { count: 0 },
    on: {
      inc: (ctx, ev) => ({ count: ctx.count + ev.by })
    }
  }).with(validateSchemas());

  expect(store.can.inc({ by: 'nope' } as any)).toBe(false);

  expect(() => store.trigger.inc({ by: 'nope' } as any)).toThrow(
    StoreValidationError
  );
  expect(store.getSnapshot().context).toEqual({ count: 0 });

  store.trigger.inc({ by: 2 });
  expect(store.getSnapshot().context).toEqual({ count: 2 });
});

it('validates final context after a macrostep', () => {
  const store = createStore({
    schemas: {
      events: {
        break: z.object({})
      },
      context: z.object({ count: z.number() })
    },
    context: { count: 0 },
    on: {
      break: () => ({ count: 'nope' }) as any
    }
  }).with(validateSchemas());

  expect(store.can.break()).toBe(false);
  expect(() => store.trigger.break()).toThrow(StoreValidationError);
});

it('validates emitted payloads before running effects', () => {
  const effectSpy = vi.fn();
  const store = createStore({
    schemas: {
      events: {
        send: z.object({})
      },
      emitted: {
        sent: z.object({ value: z.number() })
      }
    },
    context: {},
    on: {
      send: (ctx, _, enq) => {
        enq.effect(effectSpy);
        enq.emit.sent({ value: 'nope' } as any);
        return ctx;
      }
    }
  }).with(validateSchemas());

  expect(() => store.trigger.send()).toThrow(StoreValidationError);
  expect(effectSpy).not.toHaveBeenCalled();
});

it('validates no-payload events and emitted events as empty objects', () => {
  const emittedSpy = vi.fn();
  const store = createStore({
    schemas: {
      events: {
        reset: z.object({})
      },
      emitted: {
        reset: z.object({})
      }
    },
    context: { count: 1 },
    on: {
      reset: (_, __, enq) => {
        enq.emit.reset();
        return { count: 0 };
      }
    }
  }).with(validateSchemas());

  store.on('reset', emittedSpy);
  store.trigger.reset();

  expect(store.getSnapshot().context).toEqual({ count: 0 });
  expect(emittedSpy).toHaveBeenCalledWith({ type: 'reset' });
});

it('throws for unknown events and emitted events by default', () => {
  const store = createStore({
    schemas: {
      events: {
        send: z.object({})
      },
      emitted: {
        known: z.object({})
      }
    },
    context: {},
    on: {
      send: (ctx, _, enq) => {
        (enq.emit as any).unknown();
        return ctx;
      }
    }
  }).with(validateSchemas());

  expect(getThrown(() => store.send({ type: 'unknown' } as any))).toMatchObject(
    {
      reason: 'unknownEvent',
      eventType: 'unknown',
      payload: {}
    }
  );
  expect(getThrown(() => store.trigger.send())).toMatchObject({
    reason: 'unknownEmitted',
    eventType: 'unknown',
    payload: {}
  });
});

it('returns false from can for validation errors', () => {
  const store = createStore({
    schemas: {
      events: {
        inc: z.object({ by: z.number() })
      }
    },
    context: { count: 0 },
    on: {
      inc: (ctx, ev) => ({ count: ctx.count + ev.by })
    }
  }).with(validateSchemas());

  expect(store.can.inc({ by: 'nope' } as any)).toBe(false);
});

it('exposes validation error details', () => {
  const store = createStore({
    schemas: {
      events: {
        inc: z.object({ by: z.number() })
      }
    },
    context: { count: 0 },
    on: {
      inc: (ctx, ev) => ({ count: ctx.count + ev.by })
    }
  }).with(validateSchemas());

  expect(
    getThrown(() => store.trigger.inc({ by: 'nope' } as any))
  ).toMatchObject({
    name: 'StoreValidationError',
    reason: 'invalidEvent',
    eventType: 'inc',
    payload: { by: 'nope' },
    issues: expect.any(Array)
  });
});

it('throws for unknown emitted events by default', () => {
  const store = createStore({
    schemas: {
      events: {
        send: z.object({})
      },
      emitted: {
        known: z.object({})
      }
    },
    context: {},
    on: {
      send: (ctx, _, enq) => {
        (enq.emit as any).unknown();
        return ctx;
      }
    }
  }).with(validateSchemas());

  expect(getThrown(() => store.trigger.send())).toMatchObject({
    reason: 'unknownEmitted',
    eventType: 'unknown',
    payload: {}
  });
});

it('throws for unknown events by default', () => {
  const store = createStore({
    schemas: {
      events: {
        send: z.object({})
      }
    },
    context: {},
    on: {}
  }).with(validateSchemas());

  expect(getThrown(() => store.send({ type: 'unknown' } as any))).toMatchObject(
    {
      reason: 'unknownEvent',
      eventType: 'unknown',
      payload: {}
    }
  );
});

it('can ignore unknown events and emitted events', () => {
  const emittedSpy = vi.fn();
  const store = createStore({
    schemas: {
      events: {
        send: z.object({})
      },
      emitted: {
        known: z.object({})
      }
    },
    context: {},
    on: {
      send: (ctx, _, enq) => {
        (enq.emit as any).unknown();
        return ctx;
      }
    }
  }).with(
    validateSchemas({
      unknownEvents: 'ignore',
      unknownEmitted: 'ignore'
    })
  );

  store.on('*', emittedSpy);
  store.send({ type: 'unknown' } as any);
  store.trigger.send();

  expect(emittedSpy).toHaveBeenCalledWith({ type: 'unknown' });
});

it('allows extension-added event types without schemas', () => {
  const store = createStore({
    schemas: {
      context: z.object({ count: z.number() }),
      events: {
        inc: z.object({})
      }
    },
    context: { count: 0 },
    on: {
      inc: (ctx) => ({ count: ctx.count + 1 })
    }
  })
    .with(reset())
    .with(validateSchemas());

  store.trigger.inc();
  store.trigger.reset();

  expect(store.getSnapshot().context).toEqual({ count: 0 });
});

it('can opt out of individual validation areas', () => {
  const store = createStore({
    schemas: {
      events: {
        inc: z.object({ by: z.number() })
      },
      context: z.object({ count: z.number() })
    },
    context: { count: 0 },
    on: {
      inc: (ctx, ev) => ({ count: ctx.count + ev.by })
    }
  }).with(validateSchemas({ context: false, events: false }));

  store.trigger.inc({ by: 1 });
  expect(store.getSnapshot().context).toEqual({ count: 1 });
});

it('warns and no-ops in dev when there are no schemas', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const store = createStore({
    context: { count: 0 },
    on: {
      inc: (ctx) => ({ count: ctx.count + 1 })
    }
  }).with(validateSchemas());

  expect(warnSpy).toHaveBeenCalledWith(
    'The "validateSchemas" store extension was used, but the store has no schemas to validate.'
  );

  store.trigger.inc();
  expect(store.getSnapshot().context).toEqual({ count: 1 });

  warnSpy.mockRestore();
});

it('throws a validation error for async schemas', () => {
  const store = createStore({
    schemas: {
      events: {
        ping: z.object({}).refine(async () => true)
      }
    },
    context: {},
    on: {
      ping: (ctx) => ctx
    }
  }).with(validateSchemas());

  expect(getThrown(() => store.trigger.ping())).toMatchObject({
    reason: 'asyncValidationUnsupported',
    eventType: 'ping'
  });
});
