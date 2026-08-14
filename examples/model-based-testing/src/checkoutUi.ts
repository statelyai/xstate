/**
 * The *system under test*: a plain imperative checkout, written without any
 * knowledge of the machine. Generated paths drive it, and the model's states
 * say what must be true of it after every step.
 *
 * In a real project this would be a React component driven through Testing
 * Library, or an HTTP client hitting a server.
 */
export class CheckoutUi {
  public screen: 'cart' | 'shipping' | 'payment' | 'declined' | 'confirmed' =
    'cart';
  public zip: string | null = null;
  public error: string | null = null;
  public receipt: string | null = null;

  startCheckout() {
    this.screen = 'shipping';
  }

  enterAddress(zip: string) {
    if (!/^\d{5}$/.test(zip)) {
      this.error = 'Enter a 5-digit ZIP code';
      return;
    }
    this.zip = zip;
    this.error = null;
    this.screen = 'payment';
  }

  pay(card: string) {
    if (card.startsWith('4')) {
      this.receipt = `receipt-for-${this.zip}`;
      this.screen = 'confirmed';
      return;
    }
    this.error = 'Card declined';
    this.screen = 'declined';
  }

  back() {
    this.screen = 'shipping';
  }

  retry() {
    this.error = null;
    this.screen = 'payment';
  }
}
