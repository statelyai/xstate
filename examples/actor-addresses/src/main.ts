import {
  createActor,
  deliverEvent,
  setup,
  types,
  type AnyActor,
  type AnyEventObject
} from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

/** A worker that counts the pings it receives. */
const workerMachine = setup({
  schemas: {
    context: types<{ pings: number }>(),
    events: { ping: types<{}>() }
  }
}).createMachine({
  id: 'worker',
  context: { pings: 0 },
  initial: 'ready',
  states: {
    ready: {
      on: {
        ping: ({ context }) => ({ context: { pings: context.pings + 1 } })
      }
    }
  }
});

const orderMachine = setup({
  schemas: {
    context: types<{}>(),
    events: { hire: types<{}>(), kick: types<{ id: string }>() }
  },
  actors: { worker: workerMachine }
}).createMachine({
  id: 'order',
  context: {},
  // Generated child ids are per-parent counters keyed by actor source, so
  // these two are `worker:0` and `worker:1` on every run.
  entry: ({ actors }, enq) => {
    enq.spawn(actors.worker);
    enq.spawn(actors.worker, { id: 'auditor' });
  },
  initial: 'running',
  states: {
    running: {
      on: {
        hire: ({ actors }, enq) => {
          enq.spawn(actors.worker);
        },
        // Addressing a child by name, which is the last segment of its address.
        kick: ({ children, event }, enq) => {
          enq.sendTo(children[event.id]!, { type: 'ping' });
        }
      }
    }
  }
});

const actor = createActor(orderMachine, { inspect: inspector?.inspect });
actor.start();

const addresses = (root: AnyActor) =>
  Object.entries(root.getSnapshot().children).map(
    ([id, child]) => `${id} -> ${(child as AnyActor).address}`
  );

log('1. addresses are the /-joined path of actor ids from the root');
log(`   root: ${actor.address}`);
for (const line of addresses(actor)) {
  log(`   ${line}`);
}

actor.send({ type: 'hire' });
log(`   after hiring one more: ${addresses(actor).join(', ')}`);

log('\n2. sends are routed by address, not by object identity');
actor.send({ type: 'kick', id: 'auditor' });
const auditor = actor.getSnapshot().children.auditor as AnyActor;
log(`   ${auditor.address} pings: ${auditor.getSnapshot().context.pings}`);
log(`   auditor identity as JSON: ${JSON.stringify(auditor)}`);

log('\n3. addresses survive restore; sessionIds do not');
const persisted = actor.getPersistedSnapshot();
actor.stop();

const restored = createActor(orderMachine, { snapshot: persisted }).start();
const restoredAuditor = restored.getSnapshot().children.auditor as AnyActor;
log(`   address before: ${auditor.address}, after: ${restoredAuditor.address}`);
log(
  `   sessionId changed: ${auditor.sessionId !== restoredAuditor.sessionId} ` +
    `(a restored actor is a new incarnation of the same address)`
);
log(`   ping count restored: ${restoredAuditor.getSnapshot().context.pings}`);
restored.send({ type: 'hire' });
log(`   ids keep counting: ${addresses(restored).join(', ')}`);
restored.stop();

log('\n4. location transparency: persist children by address only');
const owner = createActor(orderMachine).start();
const byAddress = owner.getPersistedSnapshot({ embedChildren: false }) as any;
log(`   persisted entry: ${JSON.stringify(byAddress.children.auditor)}`);

// The children live in this process; the restored actor only holds handles to
// their addresses. A system runtime routes sends to wherever they really are.
const restoredByAddress = createActor(orderMachine, { snapshot: byAddress });
const routed: string[] = [];
restoredByAddress.system.runtime = {
  sendEvent: (
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ) => {
    // A remote handle has no sessionId: it names an actor another runtime
    // owns. Everything else is co-located and delivered locally.
    if (target.sessionId !== undefined) {
      deliverEvent(source, target, event);
      return;
    }
    routed.push(`${event.type} -> ${target.address}`);
    const name = target.address.split('/').pop()!;
    // A real runtime would put this on the wire; here the owner is in-process.
    deliverEvent(source, owner.getSnapshot().children[name] as AnyActor, event);
  }
};
restoredByAddress.start();

const handle = restoredByAddress.getSnapshot().children.auditor as AnyActor;
log(`   handle address: ${handle.address}, sessionId: ${handle.sessionId}`);
restoredByAddress.send({ type: 'kick', id: 'auditor' });
log(`   routed: ${routed.join(', ')}`);
log(
  `   the owning actor received it: ${
    (owner.getSnapshot().children.auditor as AnyActor).getSnapshot().context
      .pings
  } ping(s)`
);

// A handle exposes lifecycle only: observation is a co-located operation.
try {
  handle.getPersistedSnapshot();
} catch (error) {
  log(`   persisting a handle throws: ${(error as Error).message}`);
}

restoredByAddress.stop();
owner.stop();

inspector?.destroy();
