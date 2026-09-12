import type { EventObject, Snapshot } from 'xstate';
import type {
  PropertySut,
  PropertySutContext,
  PropertySutSendContext,
  PropertySutSession,
  PropertyTestModelExecution,
  PropertyTestModelSession,
  Step,
  TestParam
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
) => void | Promise<void>;

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
  /** Projects the DOM to a value comparable with the model projection. */
  readonly read: (page: TPage) => unknown | Promise<unknown>;
  /** Projects the model snapshot to a value comparable with the page projection. */
  readonly projectModel: (snapshot: TSnapshot) => unknown;
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
   * Per-case `page.route()` setup, keyed by the generated event case id
   * (`"<type>:<case>"`) when the property runner supplies one, otherwise by
   * the case resolved by `caseOf`. Use it to steer an invoked service to
   * success or failure on different generated paths.
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

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

/**
 * Creates a `PropertySut` that drives a Playwright page as the system under
 * test for `propertyTest()`.
 */
export function createPlaywrightSut<
  TPage extends PlaywrightPage,
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TEvent extends EventObject = EventObject
>(
  page: TPage,
  config: PlaywrightSutConfig<TPage, TSnapshot, TEvent>
): PropertySut<TSnapshot, TEvent> {
  const caseOf = config.caseOf ?? (defaultCaseOf as (event: TEvent) => string);
  const screenshotDir = config.screenshotDir ?? 'property-screenshots';

  return {
    projectModel: config.projectModel,
    ...(config.projectSut ? { projectSut: config.projectSut } : {}),
    ...(config.equivalent ? { equivalent: config.equivalent } : {}),
    create: async (
      _context: PropertySutContext<TSnapshot, TEvent>
    ): Promise<PropertySutSession<TEvent>> => {
      await config.reset?.(page);
      let appliedCase: string | undefined;
      let checkpoints = 0;

      return {
        send: async (event: TEvent, context?: PropertySutSendContext) => {
          // The generated event case id is authoritative when the property
          // runner supplies one; `caseOf` remains the fallback.
          const caseId = context?.caseId ?? caseOf(event);
          const mock =
            caseId === undefined ? undefined : config.mocks?.[caseId];
          if (mock && caseId !== appliedCase) {
            await mock(page);
            appliedCase = caseId;
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
        read: () => config.read(page),
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
        ...(config.dispose ? { dispose: () => config.dispose!(page) } : {})
      };
    }
  };
}

export interface PlaywrightTestModelParams<
  TPage extends PlaywrightPage,
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /** Performs each event against the page. */
  readonly events?: {
    readonly [TType in TEvent['type']]?: (
      page: TPage,
      step: Step<TSnapshot, TEvent extends { type: TType } ? TEvent : never>
    ) => void | Promise<void>;
  };
  /** Asserts the page matches the model for a serialized state. */
  readonly states?: {
    readonly [key: string]: (
      page: TPage,
      snapshot: TSnapshot
    ) => void | Promise<void>;
  };
  /** Per-case `page.route()` setup, keyed by the case resolved by `caseOf`. */
  readonly mocks?: {
    readonly [caseId: string]: PlaywrightMock<TPage>;
  };
  /** Resolves the mock case for an event. Defaults to `event.type`. */
  readonly caseOf?: (event: TEvent) => string | undefined;
  /** Runs once when a scenario session is created. */
  readonly reset?: (page: TPage) => void | Promise<void>;
  /** Runs when a scenario session is disposed. */
  readonly dispose?: (page: TPage) => void | Promise<void>;
}

/**
 * Creates a `PropertyTestModelExecution` for the `test` option of
 * `propertyTest()`, so a Playwright page can be driven with the
 * `TestParam`-style `events`/`states` assertions instead of SUT projections.
 */
export function createPlaywrightTestModelSession<
  TPage extends PlaywrightPage,
  TSnapshot extends Snapshot<unknown> = Snapshot<unknown>,
  TEvent extends EventObject = EventObject
>(
  page: TPage,
  params: PlaywrightTestModelParams<TPage, TSnapshot, TEvent>
): PropertyTestModelExecution<TSnapshot, TEvent> {
  const caseOf = params.caseOf ?? (defaultCaseOf as (event: TEvent) => string);

  return {
    create: async (
      _context: PropertySutContext<TSnapshot, TEvent>
    ): Promise<PropertyTestModelSession<TSnapshot, TEvent>> => {
      await params.reset?.(page);
      let appliedCase: string | undefined;

      const events: Record<
        string,
        (step: Step<TSnapshot, TEvent>) => Promise<void>
      > = {};
      for (const type of Object.keys(params.events ?? {})) {
        const action = (
          params.events as unknown as Record<
            string,
            (page: TPage, step: Step<TSnapshot, TEvent>) => void | Promise<void>
          >
        )[type];
        events[type] = async (step) => {
          const caseId = caseOf(step.event);
          const mock =
            caseId === undefined ? undefined : params.mocks?.[caseId];
          if (mock && caseId !== appliedCase) {
            await mock(page);
            appliedCase = caseId;
          }
          await action(page, step);
        };
      }

      const states: Record<string, (snapshot: TSnapshot) => Promise<void>> = {};
      for (const key of Object.keys(params.states ?? {})) {
        const assertion = params.states![key];
        states[key] = async (snapshot) => {
          await assertion(page, snapshot);
        };
      }

      return {
        params: { events, states } as unknown as TestParam<TSnapshot, TEvent>,
        ...(params.dispose ? { dispose: () => params.dispose!(page) } : {})
      };
    }
  };
}
