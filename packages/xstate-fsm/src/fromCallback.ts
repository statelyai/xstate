import { Behavior } from './types';

// interface CallbackReceiver {
//   send: (event: any) => void;
//   receive: (event: any) => void;
// }

export function fromCallback<TEvent>(
  callbackFn: (sendBack: (event: TEvent) => void) => void
): Behavior<
  any,
  undefined,
  {
    dispose: any;
  }
> {
  return {
    transition: (state) => {
      return state;
    },
    initialState: {
      dispose: undefined
    },
    start: (_state, actorCtx) => {
      const dispose = callbackFn((event) => {
        actorCtx.self.parent?.send(event as any);
      });

      return {
        dispose
      };
    },
    getSnapshot: () => undefined
  };
}
