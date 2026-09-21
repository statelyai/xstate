'use server';

import { revalidatePath } from 'next/cache';
import { advanceCheckout, ensureSessionId } from './session';

/**
 * One server action drives the whole machine: the form's submit button carries
 * the event type, the action restores the session's actor and sends it.
 */
export async function sendCheckoutEvent(formData: FormData) {
  const type = formData.get('type');
  if (typeof type !== 'string') {
    throw new Error('missing event type');
  }
  if (type !== 'addItem' && type !== 'pay' && type !== 'reset') {
    throw new Error(`unknown event "${type}"`);
  }

  const sessionId = await ensureSessionId();
  advanceCheckout(sessionId, { type });

  revalidatePath('/');
}
