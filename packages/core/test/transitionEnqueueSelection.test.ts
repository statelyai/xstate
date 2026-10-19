import {
  createActor,
  createMachine,
  type EnqueueObject
} from '../src';

describe('transition enqueue selection', () => {
  it.each(['refuse', 'continue'])('keeps effects inside a catch that would %s', (behavior) => {
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
  });

  it('accepts an effect-only transition returning undefined and evaluates once', () => {
    const effect = vi.fn();
    const evaluate = vi.fn();
    const actor = createActor(createMachine({
      on: {
        go: (_, enq) => {
          evaluate();
          enq(effect);
        }
      }
    })).start();
    actor.send({ type: 'go' });
    expect(effect).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledOnce();
  });

  it('reruns caught spawn with a real snapshot and discards its recorded prefix', () => {
    const initialize = vi.fn(() => ({ value: 42 }));
    const child = createMachine({ context: initialize });
    const effect = vi.fn();
    const refs: unknown[] = [];
    const actor = createActor(createMachine({
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
    })).start();
    expect(actor.getSnapshot().can({ type: 'go' })).toBe(true);
    expect(initialize).not.toHaveBeenCalled();
    expect(effect).not.toHaveBeenCalled();
    actor.send({ type: 'go' });
    expect(actor.getSnapshot().context.value).toBe(42);
    expect(initialize).toHaveBeenCalledOnce();
    expect(effect).toHaveBeenCalledOnce();
    expect(refs).toEqual([actor.getSnapshot().children.child]);
  });

  it('closes an escaped selection handle even during another evaluation', () => {
    let retained: EnqueueObject<any, any> | undefined;
    const effect = vi.fn();
    const actor = createActor(createMachine({
      on: {
        capture: (_, enq) => {
          retained = enq;
          return {};
        },
        check: () => {
          expect(() => retained!(effect)).toThrow('enq.* called after');
          return {};
        }
      }
    })).start();
    actor.getSnapshot().can({ type: 'capture' });
    actor.getSnapshot().can({ type: 'check' });
    expect(effect).not.toHaveBeenCalled();
  });
});
