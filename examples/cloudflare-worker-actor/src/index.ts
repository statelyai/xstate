import { createActor, type SnapshotFrom } from 'xstate';
import { ORDER_EVENTS, orderMachine, type OrderEvent } from './orderMachine';

export interface Env {
  ORDER: DurableObjectNamespace;
}

type OrderSnapshot = SnapshotFrom<typeof orderMachine>;

/**
 * One Durable Object instance per order id. The object holds no in-memory
 * actor between requests: it rehydrates the actor from its own storage,
 * applies the event, and writes the new snapshot back. Cloudflare serializes
 * requests to a single Durable Object, so this read-modify-write is safe.
 */
export class OrderActor implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Use GET to read state, POST to send an event', {
        status: 405
      });
    }

    const persisted = await this.state.storage.get<OrderSnapshot>('snapshot');
    const actor = createActor(orderMachine, { snapshot: persisted });
    actor.start();

    if (request.method === 'POST') {
      const event = (await request.json()) as OrderEvent;
      if (!ORDER_EVENTS.includes(event?.type)) {
        actor.stop();
        return Response.json(
          { error: `unknown event "${event?.type}"` },
          {
            status: 400
          }
        );
      }
      if (!actor.getSnapshot().can(event)) {
        actor.stop();
        return Response.json(
          {
            error: `cannot "${event.type}" while in "${JSON.stringify(
              actor.getSnapshot().value
            )}"`
          },
          { status: 409 }
        );
      }

      actor.send(event);

      // Persist before responding, so the reply never describes a state the
      // next request would not see.
      await this.state.storage.put(
        'snapshot',
        actor.getPersistedSnapshot() as OrderSnapshot
      );
    }

    const snapshot = actor.getSnapshot();
    actor.stop();

    return Response.json({
      state: snapshot.value,
      context: snapshot.context,
      done: snapshot.status === 'done',
      nextEvents: ORDER_EVENTS.filter((type) =>
        snapshot.can({ type } as OrderEvent)
      )
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // /orders/:id — the path segment picks which Durable Object handles it.
    const { pathname } = new URL(request.url);
    const [, prefix, orderId] = pathname.split('/');

    if (prefix !== 'orders' || !orderId) {
      return new Response('GET or POST /orders/:id', { status: 404 });
    }

    const id = env.ORDER.idFromName(orderId);
    return env.ORDER.get(id).fetch(request);
  }
};
