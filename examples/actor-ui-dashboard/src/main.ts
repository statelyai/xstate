import { mountActorUI } from '@xstate-examples/actor-ui';
import { createActor } from 'xstate';
import { connectionMachine } from './connectionMachine.ts';
import { orderMachine } from './orderMachine.ts';

const panels = document.querySelector<HTMLDivElement>('#panels')!;

const panel = () => panels.appendChild(document.createElement('div'));

const orderActor = createActor(orderMachine);
const connectionActor = createActor(connectionMachine);

// The dashboard renders the actor's snapshot and its event log, so neither
// machine needs any UI code of its own. `events` is passed explicitly here
// because `machine.events` also includes internal types such as
// `xstate.done.actor`, which are not worth a button.
mountActorUI(orderActor, panel(), {
  title: 'orderMachine',
  events: ['addItem', 'checkout', 'retry', 'cancel']
});
mountActorUI(connectionActor, panel(), {
  title: 'connectionMachine',
  events: ['connect', 'disconnect']
});

orderActor.start();
connectionActor.start();
