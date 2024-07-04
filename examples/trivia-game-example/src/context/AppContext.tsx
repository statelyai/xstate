import { createActorContext } from '@xstate/react';
import triviaMachine from '../triviaMachine';

export const TriviaMachineContext = createActorContext(triviaMachine);
