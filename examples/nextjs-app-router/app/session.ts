import { cookies } from 'next/headers';
import {
  createActor,
  type PersistedSnapshotFrom,
  type SnapshotFrom
} from 'xstate';
import { checkoutMachine } from './checkoutMachine';
import { createInspector } from '@statelyai/sdk';

/** Server-side actors are inspected only when `INSPECT=1` is set. */
const inspector = process.env.INSPECT ? createInspector() : undefined;

type CheckoutSnapshot = SnapshotFrom<typeof checkoutMachine>;
type PersistedCheckoutSnapshot = PersistedSnapshotFrom<typeof checkoutMachine>;

/**
 * Persistence stands in for a database. A module-level `Map` is enough to show
 * the shape: read snapshot, transition, write snapshot. It is per-process, so
 * it resets when the dev server restarts.
 */
const sessions = new Map<string, PersistedCheckoutSnapshot>();

const COOKIE = 'checkout-session';

export async function getSessionId(): Promise<string> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? 'anonymous';
}

/** Server components cannot set cookies, so only the action does. */
export async function ensureSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) {
    return existing;
  }
  const id = crypto.randomUUID();
  store.set(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/' });
  return id;
}

export type CheckoutView = {
  state: string;
  items: number;
};

function toView(snapshot: CheckoutSnapshot): CheckoutView {
  return {
    state: String(snapshot.value),
    items: snapshot.context.items
  };
}

export function readCheckout(sessionId: string): CheckoutView {
  const actor = createActor(checkoutMachine, {
    snapshot: sessions.get(sessionId),
    inspect: inspector?.inspect
  });
  actor.start();
  const view = toView(actor.getSnapshot());
  actor.stop();
  return view;
}

/** Restore, send one event, persist. The actor lives for one request. */
export function advanceCheckout(
  sessionId: string,
  event: { type: 'addItem' | 'pay' | 'reset' }
): CheckoutView {
  const actor = createActor(checkoutMachine, {
    snapshot: sessions.get(sessionId),
    inspect: inspector?.inspect
  });
  actor.start();
  actor.send(event);
  sessions.set(sessionId, actor.getPersistedSnapshot());
  const view = toView(actor.getSnapshot());
  actor.stop();
  return view;
}
