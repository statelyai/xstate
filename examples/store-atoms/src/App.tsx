import { useAtom, useSelector } from '@xstate/store-react';
import {
  cartStore,
  discountAtom,
  promoAtom,
  subtotalAtom,
  taxRateAtom,
  totalAtom
} from './cart.ts';

const money = (value: number) => `$${value.toFixed(2)}`;

function Cart() {
  const items = useSelector(cartStore, (s) => s.context.items);

  return (
    <ul className="cart">
      {items.map((item) => (
        <li key={item.id}>
          <span>
            {item.name} × {item.qty}
          </span>
          <button onClick={() => cartStore.trigger.remove({ id: item.id })}>
            −
          </button>
          <button onClick={() => cartStore.trigger.add({ id: item.id })}>
            +
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Reads only the atoms it needs; unrelated cart edits do not re-render it. */
function TaxControl() {
  const taxRate = useAtom(taxRateAtom);

  return (
    <label>
      Tax rate: {(taxRate * 100).toFixed(0)}%
      <input
        type="range"
        min={0}
        max={25}
        value={taxRate * 100}
        onChange={(event) => taxRateAtom.set(Number(event.target.value) / 100)}
      />
    </label>
  );
}

function PromoControl() {
  const promo = useAtom(promoAtom);

  return (
    <label>
      Promo code
      <input
        value={promo ?? ''}
        placeholder="HALFOFF"
        onChange={(event) => promoAtom.set(event.target.value || null)}
      />
    </label>
  );
}

function Totals() {
  const subtotal = useAtom(subtotalAtom);
  const discount = useAtom(discountAtom);
  const total = useAtom(totalAtom);

  return (
    <dl className="totals">
      <dt>Subtotal</dt>
      <dd>{money(subtotal)}</dd>
      <dt>Discount</dt>
      <dd>−{money(discount)}</dd>
      <dt>Total</dt>
      <dd>
        <strong>{money(total)}</strong>
      </dd>
    </dl>
  );
}

export default function App() {
  return (
    <main>
      <h1>Atoms</h1>
      <Cart />
      <TaxControl />
      <PromoControl />
      <Totals />
    </main>
  );
}
