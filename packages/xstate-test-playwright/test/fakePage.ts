/**
 * A tiny fake of the Playwright `Page` API backed by an in-memory "app": a
 * counter whose increments land immediately, or after the clock advances when a
 * latency is configured.
 */
export interface FakeApp {
  count: number;
  label: string;
}

export interface FakePageOptions {
  /** Adds a bug: every increment adds one extra. */
  readonly broken?: boolean;
  /** Milliseconds before a pending increment lands. */
  readonly latency?: number;
}

export class FakePage {
  public readonly app: FakeApp = { count: 0, label: 'idle' };
  public readonly screenshots: string[] = [];
  /** Every `route()` call, in order. */
  public readonly routes: string[] = [];
  /** The route handlers currently installed, as Playwright would hold them. */
  public readonly installedRoutes: { url: string; handler: unknown }[] = [];
  public readonly loadStates: string[] = [];
  private pending: { remaining: number; amount: number }[] = [];
  private failRequests = false;

  public constructor(private readonly options: FakePageOptions = {}) {}

  public readonly clock = {
    runFor: (ticks: number): Promise<void> => {
      this.pending = this.pending.filter((entry) => {
        entry.remaining -= ticks;
        if (entry.remaining > 0) {
          return true;
        }
        this.apply(entry.amount);
        return false;
      });
      return Promise.resolve();
    }
  };

  public click(selector: string): Promise<void> {
    if (selector === '#inc') {
      this.enqueue(1);
    } else if (selector === '#reset') {
      this.app.count = 0;
      this.app.label = 'idle';
      this.pending = [];
    } else {
      throw new Error(`Unknown selector ${selector}`);
    }
    return Promise.resolve();
  }

  public fill(selector: string, value: string): Promise<void> {
    if (selector !== '#amount') {
      throw new Error(`Unknown selector ${selector}`);
    }
    this.enqueue(Number(value));
    return Promise.resolve();
  }

  public locator(selector: string) {
    return {
      textContent: (): Promise<string | null> => {
        if (selector === '#count') {
          return Promise.resolve(String(this.app.count));
        }
        if (selector === '#label') {
          return Promise.resolve(this.app.label);
        }
        return Promise.resolve(null);
      }
    };
  }

  public waitForLoadState(state = 'load'): Promise<void> {
    this.loadStates.push(state);
    return Promise.resolve();
  }

  public screenshot(options: { path: string }): Promise<void> {
    this.screenshots.push(options.path);
    return Promise.resolve();
  }

  public route(
    url: string,
    handler: (route: { fulfill: (response: unknown) => void }) => void
  ): Promise<void> {
    this.routes.push(url);
    this.installedRoutes.push({ url, handler });
    handler({
      fulfill: (response) => {
        this.failRequests = (response as { status?: number }).status === 500;
      }
    });
    return Promise.resolve();
  }

  public unroute(url: string, handler?: unknown): Promise<void> {
    const index = this.installedRoutes.findIndex(
      (entry) =>
        entry.url === url &&
        (handler === undefined || entry.handler === handler)
    );
    if (index !== -1) {
      this.installedRoutes.splice(index, 1);
    }
    return Promise.resolve();
  }

  private enqueue(amount: number) {
    const latency = this.options.latency ?? 0;
    if (latency > 0) {
      this.pending.push({ remaining: latency, amount });
      return;
    }
    this.apply(amount);
  }

  private apply(amount: number) {
    if (this.failRequests) {
      this.app.label = 'error';
      return;
    }
    this.app.count += this.options.broken ? amount + 1 : amount;
    this.app.label = 'ok';
  }
}
