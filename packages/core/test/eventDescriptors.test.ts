import { createMachine, interpret } from '../src/index';

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

    const service = interpret(machine).start();
    service.send({ type: 'BAR' });
    expect(service.getSnapshot().value).toBe('C');
  });

  it('should not use wildcard transition over explicit one when using object `.on` config - even if wildcard comes first', () => {
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

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });
    expect(service.getSnapshot().value).toBe('pass');
  });

  it('should select wildcard over explicit event type for array `.on` config (according to document order)', () => {
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          on: [
            { event: '*', target: 'pass' },
            { event: 'NEXT', target: 'fail' }
          ]
        },
        fail: {},
        pass: {}
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });
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

    expect(
      machine.transition(undefined, { type: 'event' }).matches('success')
    ).toBeFalsy();
    expect(
      machine.transition(undefined, { type: 'eventually' }).matches('success')
    ).toBeFalsy();
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

    expect(
      machine.transition(undefined, { type: 'event' }).matches('success')
    ).toBeTruthy();
    expect(
      machine.transition(undefined, { type: 'eventually' }).matches('success')
    ).toBeFalsy();
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

    expect(
      machine
        .transition(undefined, { type: 'event.whatever' })
        .matches('success')
    ).toBeTruthy();
    expect(
      machine.transition(undefined, { type: 'eventually' }).matches('success')
    ).toBeFalsy();
    expect(
      machine
        .transition(undefined, { type: 'eventually.event' })
        .matches('success')
    ).toBeFalsy();
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

    expect(
      machine
        .transition(undefined, { type: 'event.first.second' })
        .matches('success')
    ).toBeTruthy();
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

    expect(
      machine
        .transition(undefined, { type: 'event.foo.bar.first.second' })
        .matches('success')
    ).toBeTruthy();
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

    expect(
      machine
        .transition(undefined, { type: 'event.foo.bar.first.second' })
        .matches('success')
    ).toBeFalsy();

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
      [
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "event.*.bar.*" event.",
        ],
        [
          "Infix wildcards in transition events are not allowed. Check the "event.*.bar.*" event.",
        ],
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "*.event.*" event.",
        ],
        [
          "Infix wildcards in transition events are not allowed. Check the "*.event.*" event.",
        ],
      ]
    `);

    expect(
      machine
        .transition(undefined, { type: 'whatever.event' })
        .matches('success')
    ).toBeFalsy();

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
      [
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "event.*.bar.*" event.",
        ],
        [
          "Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "*.event.*" event.",
        ],
        [
          "Infix wildcards in transition events are not allowed. Check the "*.event.*" event.",
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

    expect(
      machine
        .transition(undefined, { type: 'eventually.bar.baz' })
        .matches('success')
    ).toBeFalsy();

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

    expect(
      machine
        .transition(undefined, { type: 'prevent.whatever' })
        .matches('success')
    ).toBeFalsy();

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
