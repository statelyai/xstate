import { createStore, Reducer, Store } from 'redux';
import {
  createMachine,
  EventObject,
  interpret,
  Interpreter,
  State
} from 'xstate';

export const hello = () => {};

type Event = { type: 'UP' } | { type: 'DOWN' };

const reducer: Reducer<number, Event> = (state = 0, action) => {
  switch (action.type) {
    case 'UP':
      return state + 1;
    case 'DOWN':
      return state - 1;
    default:
      return state;
  }
};
