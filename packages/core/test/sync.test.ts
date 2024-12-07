import {
  createActor,
  createMachine,
  Observer,
  Synchronizer,
  toObserver,
  waitFor
} from '../src';

describe('synchronizers', () => {
  it('work with a synchronous synchronizer', () => {
    const snapshotRef = {
      current: JSON.stringify({ value: 'b', children: {}, status: 'active' })
    };
    const pseudoStorage = {
      getItem: (key: string) => {
        return JSON.parse(snapshotRef.current);
      },
      setItem: (key: string, value: string) => {
        snapshotRef.current = value;
      }
    };
    const createStorageSync = (key: string): Synchronizer<any> => {
      const observers = new Set();
      return {
        getSnapshot: () => pseudoStorage.getItem(key),
        setSnapshot: (snapshot) => {
          pseudoStorage.setItem(key, JSON.stringify(snapshot));
        },
        subscribe: (o) => {
          const observer = toObserver(o);

          const state = pseudoStorage.getItem(key);

          observer.next?.(state);

          observers.add(observer);

          return {
            unsubscribe: () => {
              observers.delete(observer);
            }
          };
        }
      };
    };

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {},
        b: {
          on: {
            next: 'c'
          }
        },
        c: {}
      }
    });

    const actor = createActor(machine, {
      sync: createStorageSync('test')
    }).start();

    expect(actor.getSnapshot().value).toBe('b');

    actor.send({ type: 'next' });

    expect(actor.getSnapshot().value).toBe('c');

    expect(pseudoStorage.getItem('test').value).toBe('c');
  });

  it('work with an asynchronous synchronizer', async () => {
    let snapshotRef = {
      current: undefined as any
    };
    let onChangeRef = {
      current: (() => {}) as (value: any) => void
    };
    const pseudoStorage = {
      getItem: async (key: string) => {
        if (!snapshotRef.current) {
          return undefined;
        }
        return JSON.parse(snapshotRef.current);
      },
      setItem: (key: string, value: string, source?: 'sync') => {
        snapshotRef.current = value;

        if (source !== 'sync') {
          onChangeRef.current(JSON.parse(value));
        }
      },
      subscribe: (fn: (value: any) => void) => {
        onChangeRef.current = fn;
      }
    };

    const createStorageSync = (key: string): Synchronizer<any> => {
      const observers = new Set<Observer<any>>();

      pseudoStorage.subscribe((value) => {
        observers.forEach((observer) => {
          observer.next?.(value);
        });
      });

      const getSnapshot = () => {
        if (!snapshotRef.current) {
          return undefined;
        }
        return JSON.parse(snapshotRef.current);
      };

      const storageSync = {
        getSnapshot,
        setSnapshot: (snapshot) => {
          const s = JSON.stringify(snapshot);
          pseudoStorage.setItem(key, s, 'sync');
        },
        subscribe: (o) => {
          const observer = toObserver(o);

          const state = getSnapshot();

          if (state) {
            observer.next?.(state);
          }

          observers.add(observer);

          return {
            unsubscribe: () => {
              observers.delete(observer);
            }
          };
        }
      } satisfies Synchronizer<any>;

      setTimeout(() => {
        pseudoStorage.setItem(
          'key',
          JSON.stringify({ value: 'b', children: {}, status: 'active' })
        );
      }, 100);

      return storageSync;
    };

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {},
        b: {
          on: {
            next: 'c'
          }
        },
        c: {}
      }
    });

    const actor = createActor(machine, {
      sync: createStorageSync('test')
    }).start();

    expect(actor.getSnapshot().value).toBe('a');

    await waitFor(actor, () => actor.getSnapshot().value === 'b');

    actor.send({ type: 'next' });

    expect(actor.getSnapshot().value).toBe('c');
  });
});
