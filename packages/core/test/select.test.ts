import { assign, SnapshotFrom } from '../src';
import { createMachine } from '../src/index.ts';
import { createActor } from '../src/index.ts';

describe('select', () => {
  it('should get current value', () => {
    const machine = createMachine({
      types: {} as { context: { data: number } },
      context: { data: 42 },
      initial: 'G',
      states: {
        G: {
          on: {
            INC: {
              actions: assign({ data: ({ context }) => context.data + 1 })
            }
          }
        }
      }
    });

    const service = createActor(machine).start();
    const selection = service.select(({ context }) => context.data);

    expect(selection.get()).toBe(42);

    service.send({ type: 'INC' });

    expect(selection.get()).toBe(43);
  });

  it('should subscribe to changes', () => {
    const machine = createMachine({
      types: {} as { context: { data: number } },
      context: { data: 42 },
      initial: 'G',
      states: {
        G: {
          on: {
            INC: {
              actions: assign({ data: ({ context }) => context.data + 1 })
            }
          }
        }
      }
    });

    const callback = vi.fn();
    const service = createActor(machine).start();
    const selection = service.select(({ context }) => context.data);
    selection.subscribe(callback);

    service.send({ type: 'INC' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(43);
  });

  it('should not notify if selected value has not changed', () => {
    const machine = createMachine({
      types: {} as { context: { data: number; other: string } },
      context: { data: 42, other: 'foo' },
      initial: 'G',
      states: {
        G: {
          on: {
            INC: {
              actions: assign({ data: ({ context }) => context.data + 1 })
            }
          }
        }
      }
    });

    const callback = vi.fn();
    const service = createActor(machine).start();
    const selection = service.select(({ context }) => context.other);
    selection.subscribe(callback);

    service.send({ type: 'INC' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should support custom equality function', () => {
    const machine = createMachine({
      types: {} as {
        context: { age: number; name: string };
        events:
          | {
              type: 'UPDATE_NAME';
              name: string;
            }
          | {
              type: 'UPDATE_AGE';
              age: number;
            };
      },
      context: { age: 42, name: 'John' },
      initial: 'G',
      states: {
        G: {
          on: {
            UPDATE_NAME: {
              actions: assign({ name: ({ event }) => event.name })
            },
            UPDATE_AGE: {
              actions: assign({ age: ({ event }) => event.age })
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

    const callback = vi.fn();
    const selector = ({ context }: SnapshotFrom<typeof machine>) => ({
      name: context.name,
      age: context.age
    });
    const equalityFn = (a: { name: string }, b: { name: string }) =>
      a.name === b.name; // Only compare names

    service.select(selector, equalityFn).subscribe(callback);

    service.send({ type: 'UPDATE_AGE', age: 66 });
    expect(callback).not.toHaveBeenCalled();

    service.send({ type: 'UPDATE_NAME', name: 'Jane' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe correctly', () => {
    const machine = createMachine({
      types: {} as { context: { data: number } },
      context: { data: 42 },
      initial: 'G',
      states: {
        G: {
          on: {
            INC: {
              actions: assign({ data: ({ context }) => context.data + 1 })
            }
          }
        }
      }
    });

    const service = createActor(machine).start();

    const callback = vi.fn();
    const selection = service.select(({ context }) => context.data);
    const subscription = selection.subscribe(callback);

    subscription.unsubscribe();
    service.send({ type: 'INC' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle updates with multiple subscribers', () => {
    interface PositionContext {
      position: {
        x: number;
        y: number;
      };
    }

    const machine = createMachine({
      types: {} as {
        context: {
          user: { age: number; name: string };
          position: {
            x: number;
            y: number;
          };
        };
        events:
          | {
              type: 'UPDATE_USER';
              user: { age: number; name: string };
            }
          | {
              type: 'UPDATE_POSITION';
              position: {
                x: number;
                y: number;
              };
            };
      },
      context: { position: { x: 0, y: 0 }, user: { name: 'John', age: 30 } },
      initial: 'G',
      states: {
        G: {
          on: {
            UPDATE_USER: {
              actions: assign({ user: ({ event }) => event.user })
            },
            UPDATE_POSITION: {
              actions: assign({ position: ({ event }) => event.position })
            }
          }
        }
      }
    });

    const store = createActor(machine).start();

    // Mock DOM manipulation callback
    const renderCallback = vi.fn();
    store
      .select(({ context }) => context.position)
      .subscribe((position) => {
        renderCallback(position);
      });

    // Mock logger callback for x position only
    const loggerCallback = vi.fn();
    store
      .select(({ context }) => context.position.x)
      .subscribe((x) => {
        loggerCallback(x);
      });

    // Simulate position update
    store.send({
      type: 'UPDATE_POSITION',
      position: { x: 100, y: 200 }
    });

    // Verify render callback received full position update
    expect(renderCallback).toHaveBeenCalledTimes(1);
    expect(renderCallback).toHaveBeenCalledWith({ x: 100, y: 200 });

    // Verify logger callback received only x position
    expect(loggerCallback).toHaveBeenCalledTimes(1);
    expect(loggerCallback).toHaveBeenCalledWith(100);

    // Simulate another update
    store.send({
      type: 'UPDATE_POSITION',
      position: { x: 150, y: 300 }
    });

    expect(renderCallback).toHaveBeenCalledTimes(2);
    expect(renderCallback).toHaveBeenLastCalledWith({ x: 150, y: 300 });
    expect(loggerCallback).toHaveBeenCalledTimes(2);
    expect(loggerCallback).toHaveBeenLastCalledWith(150);

    // Simulate changing only the y position
    store.send({
      type: 'UPDATE_POSITION',
      position: { x: 150, y: 400 }
    });

    expect(renderCallback).toHaveBeenCalledTimes(3);
    expect(renderCallback).toHaveBeenLastCalledWith({ x: 150, y: 400 });

    // loggerCallback should not have been called
    expect(loggerCallback).toHaveBeenCalledTimes(2);

    // Simulate changing only the user
    store.send({
      type: 'UPDATE_USER',
      user: { name: 'Jane', age: 25 }
    });

    // renderCallback should not have been called
    expect(renderCallback).toHaveBeenCalledTimes(3);

    // loggerCallback should not have been called
    expect(loggerCallback).toHaveBeenCalledTimes(2);
  });
});
