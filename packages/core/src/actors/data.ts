import { ActorBehavior } from '../types.ts';

export function fromData<T>(initialData: T): ActorBehavior<
  | {
      type: 'set';
      data: T;
    }
  | { type: 'reset' },
  T,
  {
    initialData: T;
    data: T;
  }
> {
  return {
    transition: (state, event) => {
      if (event.type === 'set') {
        return {
          ...state,
          data: event.data
        };
      }
      if (event.type === 'reset') {
        return {
          ...state,
          data: state.initialData
        };
      }
      return state;
    },
    getInitialState: () => ({
      initialData,
      data: initialData
    }),
    getSnapshot: (state) => state.data,
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };
}
