import { inspect } from '@xstate/inspect';
import { useMachine } from '@xstate/svelte';

import { machine } from './machine.js';

inspect({
  iframe: false
});

export const { state, send, service } = useMachine(machine, { devTools: true });

// service.onTransition((state) => console.log(state));
