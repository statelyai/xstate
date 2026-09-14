import { createActorContext } from '@xstate/react';
import { triviaMachine } from '../triviaMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

export const TriviaMachineContext = createActorContext(triviaMachine, {
  inspect: inspector.inspect
});
