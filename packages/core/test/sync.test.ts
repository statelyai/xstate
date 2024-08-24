import {
  createActor,
  createMachine,
  Observer,
  Synchronizer,
  toObserver
} from '../src';

describe('sync', () => {
  it('work with a synchronous synchronizer', () => {
    let snapshotRef = {
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

  it.only('work with an asynchronous synchronizer', () => {
    let snapshotRef = {
      current: JSON.stringify({ value: 'b', children: {}, status: 'active' })
    };
    let onChangeRef = {
      current: (() => {}) as (value: any) => void
    };
    const pseudoStorage = {
      getItem: async (key: string) => {
        return JSON.parse(snapshotRef.current);
      },
      setItem: (key: string, value: string) => {
        snapshotRef.current = value;

        onChangeRef.current(JSON.parse(value));
      },
      subscribe: (fn: (value: any) => void) => {
        onChangeRef.current = fn;
      }
    };

    const createStorageSync = (key: string): Synchronizer<any> => {
      const observers = new Set<Observer<any>>();
      let cachedRef = {
        current: JSON.stringify({
          value: {},
          status: 'pending',
          children: {}
        })
      };

      pseudoStorage.subscribe((value) => {
        observers.forEach((observer) => {
          observer.next?.(value);
        });
      });

      return {
        getSnapshot: () => {
          return JSON.parse(cachedRef.current);
        },
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
  });
});
