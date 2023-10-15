import { StateMachine, TypegenDisabled, createMachine } from '.';
import {
  AnyActorLogic,
  MachineContext,
  AnyEventObject,
  NonReducibleUnknown,
  MachineConfig,
  Values
} from './types';

export function provide<
  TActors extends Record<string, AnyActorLogic>,
  TActions extends Record<string, ({ params }: { params: any }) => void>,
  TGuards extends Record<string, ({ params }: { params: any }) => boolean>,
  TDelays extends Record<string, number>,
  TTags extends string[]
>({
  actors,
  actions,
  guards,
  delays
}: {
  actors?: TActors;
  actions?: TActions;
  guards?: TGuards;
  delays?: TDelays;
  tags?: TTags; // only used for types
}): {
  createMachine: <
    TContext extends MachineContext,
    TEvent extends AnyEventObject,
    TInput,
    TOutput extends NonReducibleUnknown
  >(
    config: MachineConfig<
      TContext,
      TEvent,
      Values<{
        [K in keyof TActors & string]: {
          src: K;
          logic: TActors[K];
        };
      }>,
      Values<{
        [K in keyof TActions & string]: {
          type: K;
          params: Parameters<TActions[K]>[0]['params'];
        };
      }>,
      Values<{
        [K in keyof TGuards & string]: {
          type: K;
          params: Parameters<TGuards[K]>[0]['params'];
        };
      }>,
      keyof TDelays & string,
      TTags[0],
      TInput,
      TOutput,
      TypegenDisabled
    >
  ) => StateMachine<
    TContext,
    TEvent,
    Values<{
      [K in keyof TActors & string]: {
        src: K;
        logic: TActors[K];
      };
    }>,
    Values<{
      [K in keyof TActions & string]: {
        type: K;
        params: Parameters<TActions[K]>[0]['params'];
      };
    }>,
    Values<{
      [K in keyof TGuards & string]: {
        type: K;
        params: Parameters<TGuards[K]>[0]['params'];
      };
    }>,
    keyof TDelays & string,
    TTags[0],
    TInput,
    TOutput,
    any // ResolveTypegenMeta<TTypesMeta, TEvent, TActor, TAction, TGuard, TDelay, TTag>
  >;
} {
  return {
    createMachine: (config) =>
      createMachine(config, {
        // @ts-ignore
        actors,
        // @ts-ignore
        actions,
        // @ts-ignore
        guards,
        delays
      })
  };
}
