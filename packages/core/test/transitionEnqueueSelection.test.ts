import {
  createActor,
  createMachine,
  type AnyActor,
  type EnqueueObject
} from '../src';

describe('transition enqueue selection', () => {
  it('keeps enqueue argument validation inside the transition catch', () => {
    const caught = vi.fn();
    const actor = createActor(
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              go: (_, enq) => {
                try {
                  enq.raise('invalid' as never);
                } catch {
                  caught();
                  return { target: 'fallback' };
                }
                return { target: 'b' };
              }
            }
          },
          fallback: {},
          b: {}
        }
      })
    );
    actor.subscribe({ error() {} });
    actor.start();
    actor.send({ type: 'go' });
    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().value).toBe('fallback');
    expect(caught).toHaveBeenCalledOnce();
    actor.stop();
  });

  it.each(['refuse', 'continue'])(
    'keeps effects inside a catch that would %s',
    (behavior) => {
      const effect = vi.fn();
      const caught = vi.fn();
      const evaluate = vi.fn();
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              go: (_, enq) => {
                evaluate();
                try {
                  enq(effect, 'first');
                  enq(effect, 'second');
                } catch {
                  caught();
                  if (behavior === 'refuse') {
                    return;
                  }
                }
                return { target: 'b' };
              }
            }
          },
          b: {}
        }
      });
      const actor = createActor(machine).start();
      actor.send({ type: 'go' });
      expect(actor.getSnapshot().value).toBe('b');
      expect(caught).not.toHaveBeenCalled();
      expect(evaluate).toHaveBeenCalledOnce();
      expect(effect.mock.calls).toEqual([['first'], ['second']]);
    }
  );

  it('accepts an effect-only transition returning undefined and evaluates once', () => {
    const effect = vi.fn();
    const evaluate = vi.fn();
    const actor = createActor(
      createMachine({
        on: {
          go: (_, enq) => {
            evaluate();
            enq(effect);
          }
        }
      })
    ).start();
    actor.send({ type: 'go' });
    expect(effect).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledOnce();
  });

  it('reruns caught spawn with a real snapshot and discards its recorded prefix', () => {
    const initialize = vi.fn(() => ({ value: 42 }));
    const child = createMachine({ context: initialize });
    const effect = vi.fn();
    const refs: AnyActor[] = [];
    const actor = createActor(
      createMachine({
        context: { value: 0 },
        on: {
          go: (_, enq) => {
            enq(effect);
            try {
              const ref = enq.spawn(child, { id: 'child' });
              refs.push(ref);
              return { context: { value: ref.getSnapshot().context.value } };
            } catch {
              return;
            }
          }
        }
      })
    ).start();
    expect(actor.getSnapshot().can({ type: 'go' })).toBe(true);
    expect(initialize).not.toHaveBeenCalled();
    expect(effect).not.toHaveBeenCalled();
    refs.length = 0;
    actor.send({ type: 'go' });
    expect(actor.getSnapshot().context.value).toBe(42);
    expect(initialize).toHaveBeenCalledOnce();
    expect(effect).toHaveBeenCalledOnce();
    expect(refs).toEqual([actor.getSnapshot().children.child]);
  });

  it.each([false, true])(
    'closes an escaped handle during another evaluation, real=%s',
    (real) => {
      let retained: EnqueueObject<any, any> | undefined;
      const effect = vi.fn();
      const actor = createActor(
        createMachine({
          on: {
            capture: (_, enq) => {
              if (real) {
                enq.spawn(createMachine({}));
              }
              retained = enq;
              return {};
            },
            check: () => {
              expect(() => retained!(effect)).toThrow('enq.* called after');
              return {};
            }
          }
        })
      ).start();
      if (real) {
        actor.send({ type: 'capture' });
      } else {
        actor.getSnapshot().can({ type: 'capture' });
      }
      actor.getSnapshot().can({ type: 'check' });
      expect(effect).not.toHaveBeenCalled();
    }
  );
  it('preserves raised-event processing and queued send, emit, log, cancel, and action order', () => {
    const calls: unknown[] = [];
    const payload = { marker: true };
    const target = createActor(
      createMachine({
        on: {
          sent: () => {
            calls.push('send');
            return {};
          }
        }
      })
    ).start();
    const actor = createActor(
      createMachine({
        on: {
          go: (_, enq) => {
            enq(() => calls.push(payload));
            enq.raise({ type: 'raised' });
            enq.sendTo(target, { type: 'sent' });
            enq.emit({ type: 'emitted' });
            enq.log('log');
            enq.raise({ type: 'delayed' }, { id: 'timer', delay: 10 });
            enq.cancel('timer');
            enq(() => calls.push('last'));
          },
          raised: (_, enq) => {
            enq(() => calls.push('raised'));
          }
        }
      }),
      { logger: (value) => calls.push(value) }
    );
    actor.on('emitted', () => calls.push('emit'));
    actor.start();
    actor.send({ type: 'go' });
    expect(calls).toEqual([payload, 'send', 'emit', 'log', 'last', 'raised']);
    expect(calls[0]).toBe(payload);
    expect(actor.getSnapshot().timers).toEqual([]);
    actor.stop();
    target.stop();
  });

  it.each([false, true])(
    'discards losing parallel effects and child initialization, spawn=%s',
    (spawn) => {
      const effect = vi.fn();
      const initialize = vi.fn(() => ({}));
      const child = createMachine({ context: initialize });
      const actor = createActor(
        createMachine({
          initial: 'active',
          states: {
            active: {
              type: 'parallel',
              states: {
                winner: { on: { go: () => ({ target: '#done' }) } },
                loser: {
                  on: {
                    go: (_, enq) => {
                      enq(effect);
                      if (spawn) {
                        enq.spawn(child);
                      }
                      return { target: '#done' };
                    }
                  }
                }
              }
            },
            done: { id: 'done' }
          }
        })
      ).start();
      actor.send({ type: 'go' });
      expect(actor.getSnapshot().value).toBe('done');
      expect(effect).not.toHaveBeenCalled();
      expect(initialize).not.toHaveBeenCalled();
    }
  );

  it.each(['listen', 'subscribeTo'] as const)(
    'reruns caught %s and returns one real ref',
    (method) => {
      const target = createActor(createMachine({})).start();
      const refs: AnyActor[] = [];
      const actor = createActor(
        createMachine({
          on: {
            go: (_, enq) => {
              try {
                const ref =
                  method === 'listen'
                    ? enq.listen(target, 'emitted', () => ({ type: 'heard' }))
                    : enq.subscribeTo(target, () => ({ type: 'heard' }));
                refs.push(ref);
              } catch {
                return;
              }
            },
            heard: () => ({})
          }
        })
      ).start();
      actor.send({ type: 'go' });
      expect(refs).toHaveLength(1);
      expect(refs[0]).toMatchObject({ getSnapshot: expect.any(Function) });
      expect(refs[0]!.getSnapshot().input.actor).toBe(target);
      expect(refs[0]!.sessionId).toEqual(expect.any(String));
      actor.stop();
      target.stop();
    }
  );

  it('keeps a caught parent relay enabled and sends once', () => {
    const received = vi.fn();
    const childLogic = createMachine({
      on: {
        go: ({ parent }) => {
          try {
            parent?.send({ type: 'received' });
          } catch {
            return;
          }
        }
      }
    });
    const parent = createActor(
      createMachine({
        invoke: { id: 'child', src: childLogic },
        on: {
          received: (_, enq) => {
            enq(received);
          }
        }
      })
    ).start();
    const child = parent.getSnapshot().children.child!;
    child.getSnapshot().can({ type: 'go' });
    expect(received).not.toHaveBeenCalled();
    child.send({ type: 'go' });
    expect(received).toHaveBeenCalledOnce();
    parent.stop();
  });

  it('marks outer and inner evaluations protecting the same parent', () => {
    const received = vi.fn();
    let inner: AnyActor;
    const outerLogic = createMachine({
      on: {
        go: () => {
          inner.send({ type: 'go' });
        }
      }
    });
    const innerLogic = createMachine({
      on: {
        go: ({ parent }) => {
          try {
            parent?.send({ type: 'received' });
          } catch {
            return;
          }
        }
      }
    });
    const parent = createActor(
      createMachine({
        invoke: [
          { id: 'outer', src: outerLogic },
          { id: 'inner', src: innerLogic }
        ],
        on: {
          received: (_, enq) => {
            enq(received);
          }
        }
      })
    ).start();
    inner = parent.getSnapshot().children.inner!;
    parent.getSnapshot().children.outer!.send({ type: 'go' });
    expect(received).toHaveBeenCalledOnce();
    parent.stop();
  });

  it('keeps an outer effect after a nested can evaluation', () => {
    const effect = vi.fn();
    const other = createActor(
      createMachine({ on: { check: () => ({}) } })
    ).start();
    const actor = createActor(
      createMachine({
        on: {
          go: (_, enq) => {
            enq(effect);
            other.getSnapshot().can({ type: 'check' });
          }
        }
      })
    ).start();
    actor.send({ type: 'go' });
    expect(effect).toHaveBeenCalledOnce();
  });

  it('preserves caught ref detection after a nested can evaluation', () => {
    const initialize = vi.fn(() => ({}));
    const child = createMachine({ context: initialize });
    const other = createActor(
      createMachine({ on: { check: () => ({}) } })
    ).start();
    const actor = createActor(
      createMachine({
        on: {
          go: (_, enq) => {
            try {
              enq.spawn(child, { id: 'child' });
            } catch {}
            other.getSnapshot().can({ type: 'check' });
          }
        }
      })
    ).start();
    actor.send({ type: 'go' });
    expect(initialize).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().children.child).toBeDefined();
    actor.stop();
    other.stop();
  });

  it.each([false, true])(
    'closes retained handles when a user exception escapes, real=%s',
    (real) => {
      let retained: EnqueueObject<any, any> | undefined;
      const failure = new Error('user failure');
      const actor = createActor(
        createMachine({
          on: {
            fail: (_, enq) => {
              if (real) {
                enq.spawn(createMachine({}));
              }
              retained = enq;
              throw failure;
            }
          }
        })
      );
      actor.subscribe({ error: () => {} });
      actor.start();
      actor.send({ type: 'fail' });
      expect(actor.getSnapshot().error).toBe(failure);
      expect(() => retained!.log('late')).toThrow('enq.* called after');
    }
  );

  it('replays stop before reallocating the same child id', () => {
    const childLogic = createMachine({ context: { value: 42 } });
    const actor = createActor(
      createMachine({
        entry: (_, enq) => {
          enq.spawn(childLogic, { id: 'child' });
        },
        on: {
          replace: ({ children }, enq) => {
            enq.stop(children.child);
            const replacement = enq.spawn(childLogic, { id: 'child' });
            return {
              context: { value: replacement.getSnapshot().context.value }
            };
          }
        }
      })
    ).start();
    const original = actor.getSnapshot().children.child!;
    actor.send({ type: 'replace' });
    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().context.value).toBe(42);
    expect(actor.getSnapshot().children.child).not.toBe(original);
    expect(original.getSnapshot().status).toBe('stopped');
    actor.stop();
  });
  it('does not send a caught parent relay from a losing parallel transition', () => {
    const received = vi.fn();
    const childLogic = createMachine({
      initial: 'active',
      states: {
        active: {
          type: 'parallel',
          states: {
            winner: { on: { go: () => ({ target: '#finished' }) } },
            loser: {
              on: {
                go: ({ parent }) => {
                  try {
                    parent?.send({ type: 'received' });
                  } catch {}
                  return { target: '#finished' };
                }
              }
            }
          }
        },
        finished: { id: 'finished' }
      }
    });
    const parent = createActor(
      createMachine({
        invoke: { id: 'child', src: childLogic },
        on: {
          received: (_, enq) => {
            enq(received);
          }
        }
      })
    ).start();
    const child = parent.getSnapshot().children.child!;
    child.send({ type: 'go' });
    expect(child.getSnapshot().value).toBe('finished');
    expect(received).not.toHaveBeenCalled();
    parent.stop();
  });
});
