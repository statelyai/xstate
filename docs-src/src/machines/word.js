import { Machine } from 'xstate';

export const wordMachine = Machine({
  key: 'word',
  initial: 'left',
  states: {
    left: {},
    right: {},
    center: {},
    justify: {}
  },
  on: {
    // internal transitions
    LEFT_CLICK: '.left',
    RIGHT_CLICK: '.right',
    CENTER_CLICK: '.center',
    JUSTIFY_CLICK: '.justify'
  }
});
