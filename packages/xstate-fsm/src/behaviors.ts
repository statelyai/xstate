import { Behavior } from './types';

export function fromPromise<T>(
  promiseFn: () => Promise<T>
): Behavior<
  { type: 'RESOLVE'; data: T } | { type: 'REJECT'; data: T },
  T | undefined,
  {
    promise: Promise<void> | undefined;
    data: T | undefined;
  }
> {
  return {
    transition: (state, event, actorCtx) => {
      if (event.type === 'RESOLVE') {
        actorCtx?.self.parent?.send({
          type: 'done',
          data: event.data
        });
      } else if (event.type === 'REJECT') {
        actorCtx?.self.parent?.send({
          type: 'error',
          data: event.data
        });
      }

      return state;
    },
    initialState: {
      promise: undefined,
      data: undefined
    },
    start: (state, actorCtx) => {
      return {
        ...state,
        promise: promiseFn()
          .then((data) => {
            actorCtx.self.send({ type: 'RESOLVE', data });
          })
          .catch((errData) => {
            actorCtx.self.send({ type: 'REJECT', data: errData });
          })
      };
    },
    getSnapshot: (state) => state.data
  };
}
