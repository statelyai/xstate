import type { Behavior } from './types';

export function fromPromise<T>(
  createPromise: () => Promise<T>
): Behavior<any, T> {
  return {
    start: () => {
      const observers = new Set<any>();

      createPromise().then((res) => observers.forEach((o) => o.next(res)));

      return {
        send: () => void 0,
        subscribe: (obs) => {
          observers.add(obs);

          return {
            unsubscribe: () => {
              observers.delete(obs);
            }
          };
        }
      };
    }
  };
}
