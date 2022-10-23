import { fromPromise } from './actors';
import {
  A,
  Behavior,
  DoneTransitionConfig,
  EventObject,
  InferNarrowestObject,
  SingleOrArray,
  SnapshotFrom,
  Action2
} from './types';

export interface MachineSchema {
  event?: EventObject;
  context?: Record<string, any>;
}

type SchemaObject<
  T extends MachineSchema,
  TFull extends MachineSchema = {
    context: T['context'];
    event: T['event'] | { type: 'done.invoke' };
  }
> = TFull & {
  // context: T['context'];
  // // Extend
  // event: T['event'] | { type: 'done.invoke' };

  assign: (assigner: PropertyAssigner<TFull>) => Action2<T>;
  createMachine: <TConfig extends MachineConfig2<TConfig, TFull>>(
    config: InferNarrowestObject<TConfig>
  ) => void;
};

type SchemaWith<
  TSchema extends MachineSchema,
  T extends Partial<MachineSchema>
> = TSchema & T;

interface MachineConfig2<
  Self extends MachineConfig2<any>,
  TSchema extends MachineSchema = MachineSchema
> {
  on?: {
    [EventType in (EventObject & A.Get<TSchema, ['event']>)['type']]?: {
      actions?: SingleOrArray<
        Action2<TSchema & { event: TSchema['event'] & { type: EventType } }>
      >;
    };
  };
  initial: keyof A.Get<Self, 'states'>;
  states?: {
    [StateKey in keyof A.Get<Self, 'states'>]?: StateNodeConfig2<
      A.Get<Self, ['states', StateKey]>,
      TSchema,
      Self
    >;
  };
}

export interface StateNodeConfig2<
  Self,
  TSchema extends MachineSchema,
  TMachine extends MachineConfig2<any>
> {
  entry?: Action2<TSchema>;
  exit?: Action2<TSchema>;
  invoke?: InvokeConfig2<A.Get<Self, 'invoke'>, TSchema, TMachine>;
  on?: {
    [EventType in (EventObject & TSchema['event'])['type']]?: {
      target?: keyof A.Get<TMachine, 'states'>;
      guard?: (
        context: TSchema['context'],
        event: TSchema['event'] & { type: EventType }
      ) => boolean;
      actions?: Action2<
        TSchema & { event: TSchema['event'] & { type: EventType } }
      >;
    };
  };
}

interface InvokeConfig2<
  Self,
  TSchema extends MachineSchema,
  TMachine extends MachineConfig2<any>,
  TBehavior = A.Get<Self, 'src'>,
  TDoneEvent = { type: 'done.invoke'; data: SnapshotFrom<TBehavior> }
> {
  id: string;
  src: Behavior<any, any>;
  onDone?: {
    target?: keyof A.Get<TMachine, 'states'>;
    guard?: (context: TSchema['context'], event: TDoneEvent) => boolean;
    actions?: Action2<TSchema & { event: TDoneEvent }>;
  };
}

export function createSchema<T extends MachineSchema>(
  schema: T
): SchemaObject<T> {
  return null as any;
}

type PropertyAssigner<TSchema extends MachineSchema> = {
  [K in keyof TSchema['context']]?:
    | ((
        context: TSchema['context'],
        event: TSchema['event']
      ) => TSchema['context'][K])
    | TSchema['context'][K];
};

function assign<T extends MachineSchema>(
  assigner: PropertyAssigner<T>
): Action2<T> {
  return null as any;
}

function createMachine<T extends MachineConfig2<T>>(config: T) {}

// ------

const s = createSchema({
  context: {} as { count: number },
  event: {} as { type: 'foo'; inc: number } | { type: 'bar' }
});

const m = s.createMachine({
  on: {
    foo: {
      actions: [
        assign({
          count: (c, e) => c.count + e.inc
        }),
        (ctx, e) => {
          ctx.count;
          e.type === 'foo';
          // @ts-expect-error
          e.type === 'bar';
        }
      ]
    }
  },
  initial: 'one',
  states: {
    one: {
      on: {
        foo: {
          guard: (ctx, e) => ctx.count - e.inc > 0,
          actions: assign({
            count: (c, e) => c.count + e.inc
          }),
          target: 'one'
        },
        bar: {
          guard: (ctx, e) => false,
          actions: assign({
            // count: (c, e) => c.count
            count: (c, e) => c.count
          }),
          target: 'two'
        }
      }
    },
    two: {
      invoke: {
        id: 'promise',
        src: fromPromise(() => Promise.resolve('42')),
        onDone: {
          guard: (ctx, ev) => {
            ctx.count;
            ev.data;

            // @ts-expect-error
            ctx.whatever;
            // @ts-expect-error
            ev.whatever;
            return true;
          },
          actions: (ctx, e) => {
            ctx.count + e.data;
            // @ts-expect-error
            ctx.whatever;
            // @ts-expect-error
            ev.whatever;
          }
        }
      },
      entry: (ctx, e) => {
        // @ts-expect-error
        ctx.whatever;
        // @ts-expect-error
        ev.whatever;
      },
      exit: (ctx, e) => {
        // @ts-expect-error
        ctx.whatever;
        // @ts-expect-error
        ev.whatever;
      }
    }
  }
});
