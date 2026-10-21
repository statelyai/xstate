import { z } from 'zod';
import {
  createActor,
  createMachine,
  createSystem,
  type ActorEmission,
  type ActorRefFrom,
  type AnyActor,
  type AnyEventObject,
  type Subscription
} from '../src/index.ts';

it('exposes broad system emissions while preserving registry and actor emitted types', () => {
  const machine = createMachine({
    schemas: {
      emitted: { tracked: z.object({ message: z.string() }) }
    },
    entry: (_, enq) => enq.emit({ type: 'tracked', message: 'hello' })
  });
  const listener = (emission: ActorEmission) => {
    emission.actorRef satisfies AnyActor;
    emission.event satisfies AnyEventObject;
  };
  const system = createSystem({
    registry: { app: machine },
    onEmitted: ({ actorRef, event }) => {
      actorRef satisfies AnyActor;
      event satisfies AnyEventObject;
      listener({ actorRef, event });
    }
  });
  const subscription: Subscription = system.onEmitted(listener);
  subscription.unsubscribe();
  const actor = system.createActor(machine, { registryKey: 'app' });
  actor.system.onEmitted(listener) satisfies Subscription;
  system.get('app') satisfies ActorRefFrom<typeof machine> | undefined;
  system.getAll().app satisfies ActorRefFrom<typeof machine> | undefined;
  actor.on('tracked', (event) => {
    event.type satisfies 'tracked';
    event.message satisfies string;
    // @ts-expect-error emitted payload retains its schema type
    event.message satisfies number;
  });
  if (false) {
    // @ts-expect-error registry keys remain constrained
    system.get('missing');
    // @ts-expect-error unknown emitted event type
    actor.on('missing', () => {});
    createActor(machine, {
      // @ts-expect-error system emission observation is not an actor option
      onEmitted: listener
    });
    createSystem({
      // @ts-expect-error the system listener receives a payload, not two arguments
      onEmitted: (_actor: AnyActor, _event: AnyEventObject) => {}
    });
  }
});
