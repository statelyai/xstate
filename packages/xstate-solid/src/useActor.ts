import {
  EventFromLogic,
  type ActorOptions,
  type ActorRefFrom,
  type AnyActorLogic,
  type AnyActorRef,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type SnapshotFrom
} from 'xstate';
import { fromActorRef } from './fromActorRef.ts';
import { useActorRef } from './useActorRef.ts';

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredActorOptionsKeys<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): [
  SnapshotFrom<TLogic>,
  (event: EventFromLogic<TLogic>) => void,
  ActorRefFrom<TLogic>
] {
  const actorRef = useActorRef(logic, options) as AnyActorRef;
  return [fromActorRef(actorRef)(), actorRef.send, actorRef as any];
}
