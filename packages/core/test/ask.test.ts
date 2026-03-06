import {
  Actor,
  ActorRef,
  AnyActorLogic,
  createActor,
  enqueueActions,
  EventFromLogic,
  fromTransition,
  setup,
  Snapshot
} from '../src';

/** Extracts askable events (events with respondTo) from actor logic. */
type AskableEvents<TLogic extends AnyActorLogic> = Extract<
  EventFromLogic<TLogic>,
  { respondTo: ActorRef<any, any, any> }
>;

/** Extracts the response event type from an askable event. */
type ResponseOf<TAskEvent> = TAskEvent extends {
  respondTo: ActorRef<any, infer TResponse, any>;
}
  ? TResponse
  : never;

/**
 * Type-safe ask pattern for XState actors. Sends an event to an actor and waits
 * for a response.
 */
function ask<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>,
  event: Omit<AskableEvents<TLogic>, 'respondTo'>
): {
  map: <TResult>(
    responseMapper: (response: ResponseOf<AskableEvents<TLogic>>) => TResult
  ) => Promise<TResult>;
} {
  type TResponse = ResponseOf<AskableEvents<TLogic>>;

  return {
    map: <TResult>(responseMapper: (response: TResponse) => TResult) => {
      type ResolveEvent = { type: 'resolve'; value: TResult };

      const tempActor = createActor(
        fromTransition<undefined, TResponse, any, undefined, ResolveEvent>(
          (_, e, actorScope) => {
            actorScope.emit({ type: 'resolve', value: responseMapper(e) });
            return undefined;
          },
          undefined
        )
      ).start();

      const promise = new Promise<TResult>((res) => {
        tempActor.on('resolve', (ev) => {
          res(ev.value);
        });
      });

      actor.send({
        ...event,
        respondTo: tempActor
      } as AskableEvents<TLogic>);

      return promise;
    }
  };
}

describe('ask pattern', () => {
  it('should work', async () => {
    // Define response event type
    type AnswerEvent = { type: 'answer'; answer: number };

    const machine = setup({
      types: {
        events: {} as {
          type: 'ask';
          respondTo: ActorRef<Snapshot<unknown>, AnswerEvent>;
        }
      }
    }).createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            ask: {
              actions: enqueueActions(({ event, enqueue }) => {
                enqueue.sendTo(event.respondTo, { type: 'answer', answer: 42 });
              })
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    const result = await ask(actor, { type: 'ask' }).map(
      (response) => response.answer
    );

    result satisfies number;
    // @ts-expect-error
    result satisfies string;

    expect(result).toEqual(42);
  });
});
