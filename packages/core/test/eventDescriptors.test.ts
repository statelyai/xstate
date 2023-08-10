import { createMachine, createActor } from '../src/index';

describe('event descriptors', () => {
  it('should fallback to using wildcard transition definition (if specified)', () => {
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          on: {
            FOO: 'B',
            '*': 'C'
          }
        },
        B: {},
        C: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'BAR' });
    expect(service.getSnapshot().value).toBe('C');
  });

  it('should prioritize explicit descriptor even if wildcard comes first', () => {
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          on: {
            '*': 'fail',
            NEXT: 'pass'
          }
        },
        fail: {},
        pass: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'NEXT' });
    expect(service.getSnapshot().value).toBe('pass');
  });

  it('should prioritize explicit descriptor even if a partial one comes first', () => {
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          on: {
            'foo.*': 'fail',
            'foo.bar': 'pass'
          }
        },
        fail: {},
        pass: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'foo.bar' });
    expect(service.getSnapshot().value).toBe('pass');
  });

  it('should prioritize a longer descriptor even if the shorter one comes first', () => {
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          on: {
            'foo.*': 'fail',
            'foo.bar.*': 'pass'
          }
        },
        fail: {},
        pass: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'foo.bar.baz' });
    expect(service.getSnapshot().value).toBe('pass');
  });

  it(`should use a shorter descriptor if the longer one doesn't match`, () => {
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          on: {
            'foo.bar.*': {
              target: 'fail',
              guard: () => false
            },
            'foo.*': 'pass'
          }
        },
        fail: {},
        pass: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'foo.bar.baz' });
    expect(service.getSnapshot().value).toBe('pass');
  });

  it('should NOT support non-tokenized wildcards', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            'event*': 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef1 = createActor(machine).start();

    actorRef1.send({ type: 'event' });

    expect(actorRef1.getSnapshot().matches('success')).toBeFalsy();

    const actorRef2 = createActor(machine).start();

    actorRef2.send({ type: 'eventually' });

    expect(actorRef2.getSnapshot().matches('success')).toBeFalsy();
  });

  it('should support prefix matching with wildcards (+0)', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            'event.*': 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef1 = createActor(machine).start();

    actorRef1.send({ type: 'event' });

    expect(actorRef1.getSnapshot().matches('success')).toBeTruthy();

    const actorRef2 = createActor(machine).start();

    actorRef2.send({ type: 'eventually' });

    expect(actorRef2.getSnapshot().matches('success')).toBeFalsy();
  });

  it('should support prefix matching with wildcards (+1)', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            'event.*': 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef1 = createActor(machine).start();

    actorRef1.send({ type: 'event.whatever' });

    expect(actorRef1.getSnapshot().matches('success')).toBeTruthy();

    const actorRef2 = createActor(machine).start();

    actorRef2.send({ type: 'eventually' });

    expect(actorRef2.getSnapshot().matches('success')).toBeFalsy();

    const actorRef3 = createActor(machine).start();

    actorRef3.send({ type: 'eventually.event' });

    expect(actorRef3.getSnapshot().matches('success')).toBeFalsy();
  });

  it('should support prefix matching with wildcards (+n)', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            'event.*': 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'event.first.second' });

    expect(actorRef.getSnapshot().matches('success')).toBeTruthy();
  });

  it('should support prefix matching with wildcards (+n, multi-prefix)', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            'event.foo.bar.*': 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'event.foo.bar.first.second' });

    expect(actorRef.getSnapshot().matches('success')).toBeTruthy();
  });

  it('should not match infix wildcards', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            'event.*.bar.*': 'success',
            '*.event.*': 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef1 = createActor(machine).start();

    actorRef1.send({ type: 'event.foo.bar.first.second' });

    expect(actorRef1.getSnapshot().matches('success')).toBeFalsy();

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
      [
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "event.*.bar.*" event.",
        ],
        [
          "Infix wildcards in transition events are not allowed. Check the "event.*.bar.*" transition.",
        ],
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "*.event.*" event.",
        ],
        [
          "Infix wildcards in transition events are not allowed. Check the "*.event.*" transition.",
        ],
      ]
    `);

    const actorRef2 = createActor(machine).start();

    actorRef2.send({ type: 'whatever.event' });

    expect(actorRef2.getSnapshot().matches('success')).toBeFalsy();

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
      [
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "event.*.bar.*" event.",
        ],
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "*.event.*" event.",
        ],
        [
          "Infix wildcards in transition events are not allowed. Check the "*.event.*" transition.",
        ],
      ]
    `);
  });

  it('should not match wildcards as part of tokens', () => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            'event*.bar.*': 'success',
            '*event.*': 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actorRef1 = createActor(machine).start();

    actorRef1.send({ type: 'eventually.bar.baz' });

    expect(actorRef1.getSnapshot().matches('success')).toBeFalsy();

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
      [
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "event*.bar.*" event.",
        ],
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "*event.*" event.",
        ],
      ]
    `);

    const actorRef2 = createActor(machine).start();

    actorRef2.send({ type: 'prevent.whatever' });

    expect(actorRef2.getSnapshot().matches('success')).toBeFalsy();

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
      [
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "event*.bar.*" event.",
        ],
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "*event.*" event.",
        ],
      ]
    `);
  });
});
