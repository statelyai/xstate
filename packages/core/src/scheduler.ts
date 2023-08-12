import { fromCallback } from './actors/callback.ts';
import type { ActorRef, AnyEventObject, EventFrom } from './types.ts';

export type ClockActor = ActorRef<
  | {
      type: 'xstate.clock.setTimeout';
      source: ActorRef<any>;
      target: ActorRef<any>;
      event: AnyEventObject;
      id: string;
      timeout: number;
    }
  | {
      type: 'xstate.clock.clearTimeout';
      source: ActorRef<any>;
      id: string;
    }
  | {
      type: 'xstate.clock.clearAllTimeouts';
      source: ActorRef<any>;
    }
>;

export const clockActorLogic = fromCallback(({ receive }) => {
  let timeouts = new Map<string, Map<string, any>>();

  receive((msg: EventFrom<ClockActor>) => {
    switch (msg.type) {
      case 'xstate.clock.setTimeout': {
        const { id, timeout } = msg;
        timeouts.set(
          id,
          setTimeout(() => {
            msg.target.send(msg.event);
          }, timeout)
        );
        break;
      }
      case 'xstate.clock.clearTimeout': {
        const { id } = msg;
        if (timeouts.has(id)) {
          clearTimeout(timeouts.get(id));
        }
        break;
      }
    }
  });

  return () => {
    timeouts.forEach((timeout) => clearTimeout(timeout));
    timeouts.clear();
  };
});
