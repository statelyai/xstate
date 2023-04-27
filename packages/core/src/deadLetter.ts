import { fromTransition } from './actors/transition.ts';
import type { AnyEventObject } from './types.ts';

export const deadLettersBehavior = fromTransition<
  any,
  {
    type: 'deadLetter';
    event: AnyEventObject;
  },
  any
>((state, event) => {
  if (event.type === 'deadLetter') {
    state.push({
      event: event.event
    });
  }

  return state;
}, []);
