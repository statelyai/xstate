import { toSCXMLEvent } from '..';
import { ActorBehavior } from '../types';

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
    transition: (state, _event) => {
      const scxmlEvent = toSCXMLEvent(_event);
      const event = scxmlEvent.data;

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
