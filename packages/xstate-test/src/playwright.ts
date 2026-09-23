import type { EventObject, Snapshot } from 'xstate';
import type {
  TestStateAssertions,
  TestSut,
  TestSutContext,
  TestSutSendContext,
  TestSutSession
} from 'xstate/graph';

/**
 * The subset of the Playwright `Page` API this package uses.
 *
 * A real `Page` from `playwright` or `@playwright/test` is assignable to this
 * type, so no Playwright import is needed at runtime or at type-check time.
 * Everything is optional because only the parts your configuration reaches for
 * are used.
 */
export interface PlaywrightPage {
  readonly waitForLoadState?: (state?: any, options?: any) => Promise<void>;
  readonly screenshot?: (options?: any) => Promise<any>;
  readonly route?: (url: any, handler: any, options?: any) => Promise<unknown>;
  readonly unroute?: (url: any, handler?: any) => Promise<void>;
  readonly clock?: {
    readonly runFor?: (ticks: any) => Promise<void>;
  };
}

/** A Playwright action bound to a generated event. */
export type PlaywrightEventAction<
  TPage extends PlaywrightPage,
  TEvent extends EventObject
> = (page: TPage, event: TEvent) => void | Promise<void>;

/** Per-event-case network stubbing, applied before the event action runs. */
export type PlaywrightMock<TPage extends PlaywrightPage> = (
  page: TPage
) => void | Promise<unknown>;

export interface PlaywrightSutConfig<
  TPage extends PlaywrightPage,
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /** Performs each event against the page. */
  readonly events: {
    readonly [TType in TEvent['type']]?: PlaywrightEventAction<
      TPage,
      TEvent extends { type: TType } ? TEvent : never
    >;
  };
  /**
   * Projects the DOM to a value comparable with the model projection. Omit it
   * (together with `projectModel`) to assert through `states` instead.
   */
  readonly read?: (page: TPage) => unknown | Promise<unknown>;
  /** Projects the model snapshot to a value comparable with the page projection. */
  readonly projectModel?: (snapshot: TSnapshot) => unknown;
  /**
   * Per-state assertions run after every stable step, keyed by state value (or
   * `'#id'`), with `'*'` as the fallthrough.
   */
  readonly states?: {
    readonly [stateKey: string]: (
      page: TPage,
      snapshot: TSnapshot
    ) => void | Promise<void>;
  };
  /** Normalizes the value read from the page before comparison. */
  readonly projectSut?: (observed: unknown) => unknown;
  /** Compares model and page projections. Defaults to deep equality. */
  readonly equivalent?: (
    model: unknown,
    sut: unknown
  ) => boolean | Promise<boolean>;
  /**
   * Waits for the page to become quiescent before every comparison. Defaults to
   * `page.waitForLoadState('networkidle')` when the page provides it.
   */
  readonly settle?: (page: TPage) => void | Promise<void>;
  /**
   * Advances page time. Defaults to `page.clock.runFor(milliseconds)` when
   * Playwright's clock API is installed, and returns no events.
   */
  readonly advance?: (
    page: TPage,
    milliseconds: number
  ) => readonly TEvent[] | Promise<readonly TEvent[]>;
  /**
   * Records a checkpoint. Defaults to a screenshot written to the
   * configured screenshot directory.
   */
  readonly checkpoint?: (page: TPage, label: string) => void | Promise<void>;
  /** Directory for default checkpoint screenshots. */
  readonly screenshotDir?: string;
  /** Runs once when a scenario session is created. */
  readonly reset?: (page: TPage) => void | Promise<void>;
  /** Runs when a scenario stops. */
  readonly stop?: (page: TPage) => void | Promise<void>;
  /** Runs when a scenario session is disposed. */
  readonly dispose?: (page: TPage) => void | Promise<void>;
  /**
   * Per-case `page.route()` setup. When the property runner supplies the
   * generated event case, the key is looked up as `"<type>.<case>"` first and
   * then as `"<case>"`; otherwise (prefix, clock and replayed events) the key
   * is the case resolved by `caseOf`. Use it to steer an invoked service to
   * success or failure on different generated paths.
   *
   * Routes installed by a mock are unrouted before another case's mock is
   * applied and when the scenario session is disposed, so handlers do not
   * leak across cases or runs.
   */
  readonly mocks?: {
    readonly [caseId: string]: PlaywrightMock<TPage>;
  };
  /**
   * Resolves the mock case for an event. Defaults to `event.case` when present,
   * otherwise `event.type`.
   */
  readonly caseOf?: (event: TEvent) => string | undefined;
}

function defaultCaseOf(event: EventObject): string {
  const explicit = (event as { case?: unknown }).case;
  return typeof explicit === 'string' ? explicit : event.type;
}

type InstalledRoute = readonly unknown[];

/**
 * Wraps a page so every `route()` a mock installs is recorded and can be
 * removed again when another case's mock is applied or the session is disposed.
 */
function trackRoutes<TPage extends PlaywrightPage>(
  page: TPage,
  installed: InstalledRoute[]
): TPage {
  if (typeof (page as { route?: unknown }).route !== 'function') {
    return page;
  }
  return new Proxy(page as object, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      if (property === 'route') {
        return (...args: unknown[]) => {
          installed.push(args);
          return value.apply(target, args);
        };
      }
      return value.bind(target);
    }
  }) as TPage;
}

/** Removes every route a mock installed through {@link trackRoutes}. */
async function releaseRoutes<TPage extends PlaywrightPage>(
  page: TPage,
  installed: InstalledRoute[]
): Promise<void> {
  const unroute = (page as { unroute?: (...args: unknown[]) => unknown })
    .unroute;
  if (typeof unroute === 'function') {
    for (const args of installed) {
      await unroute.call(page, args[0], args[1]);
    }
  }
  installed.length = 0;
}

/**
 * Resolves the mock for a generated event case, trying `"<type>.<case>"`, then
 * `"<case>"`, then the case resolved by `caseOf`.
 */
function resolveMock<TPage extends PlaywrightPage>(
  mocks: Record<string, PlaywrightMock<TPage> | undefined> | undefined,
  eventCase: { readonly type: string; readonly name: string } | undefined,
  fallbackCase: string | undefined
): { key: string; mock: PlaywrightMock<TPage> } | undefined {
  if (!mocks) {
    return undefined;
  }
  const keys = [
    ...(eventCase
      ? [`${eventCase.type}.${eventCase.name}`, eventCase.name]
      : []),
    ...(fallbackCase === undefined ? [] : [fallbackCase])
  ];
  for (const key of keys) {
    const mock = mocks[key];
    if (mock) {
      return { key, mock };
    }
  }
  return undefined;
}

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

/**
 * Creates a `TestSut` that drives a Playwright page as the system under
 * test for `propertyTest()`.
 */
export function createPlaywrightSut<
  TPage extends PlaywrightPage,
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TEvent extends EventObject = EventObject
>(
  page: TPage,
  config: PlaywrightSutConfig<TPage, TSnapshot, TEvent>
): TestSut<TSnapshot, TEvent> {
  const caseOf = config.caseOf ?? (defaultCaseOf as (event: TEvent) => string);
  const screenshotDir = config.screenshotDir ?? 'property-screenshots';

  return {
    ...(config.projectModel ? { projectModel: config.projectModel } : {}),
    ...(config.projectSut ? { projectSut: config.projectSut } : {}),
    ...(config.equivalent ? { equivalent: config.equivalent } : {}),
    create: async (
      _context: TestSutContext<TSnapshot, TEvent>
    ): Promise<TestSutSession<TSnapshot, TEvent>> => {
      await config.reset?.(page);
      let appliedCase: string | undefined;
      let checkpoints = 0;
      const installedRoutes: InstalledRoute[] = [];
      const mockPage = trackRoutes(page, installedRoutes);

      return {
        send: async (
          event: TEvent,
          context?: TestSutSendContext<TSnapshot>
        ) => {
          // The generated event case is authoritative when the property runner
          // supplies one; `caseOf` remains the fallback.
          const resolved = resolveMock(
            config.mocks as
              | Record<string, PlaywrightMock<TPage> | undefined>
              | undefined,
            context?.case,
            caseOf(event)
          );
          if (resolved && resolved.key !== appliedCase) {
            // Remove the previous case's routes so its handlers stop
            // intercepting before the new case's mock installs its own.
            await releaseRoutes(page, installedRoutes);
            await resolved.mock(mockPage);
            appliedCase = resolved.key;
          }
          const action = (
            config.events as Record<
              string,
              PlaywrightEventAction<TPage, TEvent> | undefined
            >
          )[event.type];
          if (!action) {
            throw new Error(
              `No Playwright action configured for event "${event.type}"`
            );
          }
          await action(page, event);
        },
        ...(config.read ? { read: () => config.read!(page) } : {}),
        ...(config.states
          ? {
              states: Object.fromEntries(
                Object.entries(config.states).map(([key, assertion]) => [
                  key,
                  (snapshot: TSnapshot) => assertion(page, snapshot)
                ])
              ) as unknown as TestStateAssertions<TSnapshot, TEvent>
            }
          : {}),
        settle: async () => {
          if (config.settle) {
            await config.settle(page);
            return;
          }
          await page.waitForLoadState?.('networkidle');
        },
        advance: async (milliseconds: number) => {
          if (config.advance) {
            return config.advance(page, milliseconds);
          }
          await page.clock?.runFor?.(milliseconds);
          return [];
        },
        checkpoint: async (label?: string) => {
          const resolved = label ?? `checkpoint-${checkpoints}`;
          checkpoints++;
          if (config.checkpoint) {
            await config.checkpoint(page, resolved);
            return;
          }
          await page.screenshot?.({
            path: `${screenshotDir}/${sanitizeLabel(resolved)}.png`
          });
        },
        ...(config.stop ? { stop: () => config.stop!(page) } : {}),
        dispose: async () => {
          try {
            await releaseRoutes(page, installedRoutes);
          } finally {
            await config.dispose?.(page);
          }
        }
      };
    }
  };
}
