import { Behavior } from '.';

export function fromPromise<T>(
  promiseFn: () => Promise<T>
): Behavior<
  { type: 'RESOLVE'; data: T },
  any,
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
        promise: promiseFn().then((data) => {
          actorCtx.self.send({ type: 'RESOLVE', data });
        })
      };
    }
  };
}
