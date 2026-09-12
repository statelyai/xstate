import { sendCheckoutEvent } from './actions';
import { HelpToggle } from './HelpToggle';
import { getSessionId, readCheckout } from './session';

// The persisted machine is per-session, so this page cannot be static.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const sessionId = await getSessionId();
  const checkout = readCheckout(sessionId);

  return (
    <main>
      <h1>Checkout</h1>
      <p>
        state: <strong>{checkout.state}</strong> · items:{' '}
        <strong>{checkout.items}</strong>
      </p>
      <form action={sendCheckoutEvent}>
        <button name="type" value="addItem" type="submit">
          Add item
        </button>{' '}
        <button name="type" value="pay" type="submit">
          Pay
        </button>{' '}
        <button name="type" value="reset" type="submit">
          Reset
        </button>
      </form>
      <HelpToggle />
    </main>
  );
}
