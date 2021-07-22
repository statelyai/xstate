import { sendParent } from './actions';
import { createMachine } from './Machine';

declare module './types' {
  export interface GlobalEvents {
    SOMETHING: {
      wow: true;
    };
    INCREDIBLE: {
      amazing: false;
    };
  }
}

const machine = createMachine({
  entry: [
    sendParent({
      type: 'INCREDIBLE',
      amazing: false
    })
  ],
  on: {}
});
