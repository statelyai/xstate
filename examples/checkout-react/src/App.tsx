import { useActor } from '@xstate/react';
import { checkoutMachine, total, type CartItem } from './checkoutMachine';

const CATALOG: CartItem[] = [
  { id: 'tea', name: 'Loose leaf tea', price: 12 },
  { id: 'pot', name: 'Teapot', price: 34 },
  { id: 'cup', name: 'Cup', price: 8 }
];

export default function App() {
  const [state, send] = useActor(checkoutMachine);
  const { cart, shipping, payment, receipt, error } = state.context;

  if (state.matches('done') && receipt) {
    return (
      <main>
        <h1>Order placed</h1>
        <p className="ok">Receipt {receipt.id.slice(0, 8)}</p>
        <p>Charged ${receipt.total}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Checkout — {String(state.value)}</h1>

      {state.matches('cart') && (
        <>
          <ul>
            {cart.map((item) => (
              <li key={item.id}>
                {item.name} — ${item.price}{' '}
                <button
                  onClick={() => send({ type: 'removeItem', id: item.id })}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
          {CATALOG.map((item) => (
            <button
              key={item.id}
              onClick={() => send({ type: 'addItem', item })}
            >
              Add {item.name} (${item.price})
            </button>
          ))}
          <p>Total: ${total(cart)}</p>
          <button onClick={() => send({ type: 'next' })}>
            Continue to shipping
          </button>
          {cart.length === 0 && (
            <p className="hint">An empty cart cannot advance.</p>
          )}
        </>
      )}

      {state.matches('shipping') && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send({ type: 'next' });
            }}
          >
            {(['name', 'address', 'city'] as const).map((field) => (
              <label key={field}>
                {field}
                <input
                  value={shipping[field]}
                  onChange={(e) =>
                    send({
                      type: 'setShipping',
                      ...shipping,
                      [field]: e.target.value
                    })
                  }
                />
              </label>
            ))}
            <button type="submit">Continue to payment</button>
          </form>
          <button onClick={() => send({ type: 'editCart' })}>Edit cart</button>
          <p className="hint">All three fields are required to advance.</p>
        </>
      )}

      {state.matches('payment') && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send({ type: 'next' });
            }}
          >
            <label>
              Card number
              <input
                value={payment.cardNumber}
                onChange={(e) =>
                  send({ type: 'setPayment', cardNumber: e.target.value })
                }
              />
            </label>
            <button type="submit">Pay ${total(cart)}</button>
          </form>
          <button onClick={() => send({ type: 'back' })}>Back</button>
          <button onClick={() => send({ type: 'editCart' })}>Edit cart</button>
          <p className="hint">
            Any 12+ digit card works. A card ending in <code>0000</code> is
            declined.
          </p>
        </>
      )}

      {state.matches('confirming') && <p>Charging card…</p>}

      {state.matches('declined') && (
        <>
          <p className="error">{error}</p>
          <button onClick={() => send({ type: 'retry' })}>
            Use another card
          </button>
          <button onClick={() => send({ type: 'editCart' })}>Edit cart</button>
        </>
      )}
    </main>
  );
}
