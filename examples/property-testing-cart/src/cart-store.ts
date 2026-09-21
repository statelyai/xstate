import type { CartItems } from './cart.machine.ts';

export type CartEvent =
  | { type: 'ADD'; sku: string; qty: number }
  | { type: 'REMOVE'; sku: string }
  | { type: 'CHECKOUT' };

export interface CartStoreState {
  readonly items: CartItems;
  readonly status: 'shopping' | 'paying' | 'done';
}

/**
 * A hand-written cart, standing in for the real implementation a team would
 * property-test their machine against.
 *
 * Setting `CART_BUG=1` introduces one deliberate defect: removing a SKU leaves
 * it in the cart with a quantity of zero instead of taking it out. The README
 * uses it to show what a counterexample looks like.
 */
export class CartStore {
  private items: Record<string, number> = {};
  private status: CartStoreState['status'] = 'shopping';
  private readonly buggy = process.env.CART_BUG === '1';

  public dispatch(event: CartEvent): void {
    if (this.status !== 'shopping') {
      return;
    }
    switch (event.type) {
      case 'ADD':
        this.items[event.sku] = (this.items[event.sku] ?? 0) + event.qty;
        return;
      case 'REMOVE':
        if (this.buggy && event.sku in this.items) {
          // The defect: the SKU stays in the cart at quantity zero.
          this.items[event.sku] = 0;
          return;
        }
        delete this.items[event.sku];
        return;
      case 'CHECKOUT':
        if (Object.keys(this.items).length) {
          this.status = 'paying';
        }
    }
  }

  public getState(): CartStoreState {
    return { items: { ...this.items }, status: this.status };
  }
}
