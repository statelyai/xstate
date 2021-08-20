import { inspect } from '@xstate/inspect';
import { interpret } from 'xstate';

import { machine } from './machine.js';

inspect({
  iframe: false
});

export const service = interpret(machine, { devTools: true }).start();
