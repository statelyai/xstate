import { fromCallback } from './actors/callback.ts';
import { Clock } from './interpreter.ts';
import type { ActorRef, AnyEventObject, EventFrom } from './types.ts';

export type SchedulerActorRef = ActorRef<
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

export function createSchedulerLogic(clock: Clock) {
  const clockActorLogic = fromCallback(({ receive }) => {
    let timeouts = new Map<
      // session ID
      string,
      Map<
        // custom timeout ID
        string,
        // actual timeout ID
        any
      >
    >();

    receive((msg: EventFrom<SchedulerActorRef>) => {
      switch (msg.type) {
        case 'xstate.clock.setTimeout': {
          const { id, timeout } = msg;
          const sessionTimeoutMap =
            timeouts.get(msg.source.sessionId) || new Map();
          timeouts.set(msg.source.sessionId, sessionTimeoutMap);

          sessionTimeoutMap.set(
            id,
            clock.setTimeout(() => {
              msg.target.send(msg.event);
              sessionTimeoutMap.delete(id);
            }, timeout)
          );
          break;
        }
        case 'xstate.clock.clearTimeout': {
          const { id } = msg;
          const sessionTimeoutMap = timeouts.get(msg.source.sessionId);

          if (sessionTimeoutMap?.has(id)) {
            clock.clearTimeout(sessionTimeoutMap.get(id));
          }
          break;
        }
        case 'xstate.clock.clearAllTimeouts': {
          const sessionTimeoutMap = timeouts.get(msg.source.sessionId);

          if (sessionTimeoutMap) {
            sessionTimeoutMap.forEach((timeout) => clock.clearTimeout(timeout));
            sessionTimeoutMap.clear();
          }

          break;
        }
      }
    });

    return () => {
      timeouts.forEach((timeoutMap) => {
        timeoutMap.forEach((timeout) => clock.clearTimeout(timeout));
      });
      timeouts.clear();
    };
  });

  return clockActorLogic;
}

export const clockActorLogic = createSchedulerLogic({
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id)
});
