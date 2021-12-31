import { assign } from './actions';
import { createMachine } from './Machine';
import type { EventObject, BaseActionObject } from './types';
import { mapValues } from './utils';
import {
  Cast,
  UnionFromCreatorsReturnTypes,
  FinalModelCreators,
  Model,
  ModelCreators,
  Prop,
  IsNever
} from './model.types';
import { DefaultExtraGenerics, ExtraGenerics } from '.';

export function createModel<
  TContext,
  TEvent extends EventObject,
  TExtra extends ExtraGenerics = DefaultExtraGenerics<TContext, TEvent>
>(initialContext: TContext): Model<TContext, TEvent, TExtra, void>;
export function createModel<
  TContext,
  TModelCreators extends ModelCreators<TModelCreators>,
  TFinalModelCreators = FinalModelCreators<TModelCreators>,
  TComputedEvent = UnionFromCreatorsReturnTypes<
    Prop<TFinalModelCreators, 'events'>
  >,
  TComputedAction = UnionFromCreatorsReturnTypes<
    Prop<TFinalModelCreators, 'actions'>
  >
>(
  initialContext: TContext,
  creators: TModelCreators
): Model<
  TContext,
  Cast<TComputedEvent, EventObject>,
  {
    actions: IsNever<TComputedAction> extends true
      ? BaseActionObject
      : Cast<TComputedAction, BaseActionObject>;
    guards: { type: string };
  },
  TFinalModelCreators
>;
export function createModel(
  initialContext: object,
  creators?: ModelCreators<any>
): unknown {
  const eventCreators = creators?.events;
  const actionCreators = creators?.actions;

  const model = {
    initialContext,
    assign,
    events: (eventCreators
      ? mapValues(eventCreators, (fn, eventType) => (...args: any[]) => ({
          ...fn(...args),
          type: eventType
        }))
      : undefined) as any,
    actions: actionCreators
      ? mapValues(actionCreators, (fn, actionType) => (...args: any[]) => ({
          ...fn(...args),
          type: actionType
        }))
      : undefined,
    reset: () => assign(initialContext),
    createMachine: (config, implementations) => {
      return createMachine(
        'context' in config ? config : { ...config, context: initialContext },
        implementations
      );
    },
    withActions: () => model,
    withGuards: () => model
  } as Model<any, any, any, any>;

  return model;
}

// const model = createModel({ foo: 'string' })
//   .withActions<{ type: 'doThis'; greet: string } | { type: 'doThat' }>()
//   .withGuards<{ type: 'isAllowed' } | { type: 'isNotAllowed' }>();

// model.createMachine(
//   {
//     initial: 'foo',
//     states: {
//       foo: {
//         on: {
//           SOMETHING: {
//             cond: 'isAllowed',
//             actions: { type: 'doThis' }
//           }
//         }
//       }
//     },
//     entry: { type: 'doThis', greet: 'test' }
//   },
//   {
//     actions: {
//       doThat: () => {}
//     },
//     guards: {
//       isAllowed: () => true
//     }
//   }
// );
