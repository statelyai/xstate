import { fromCallback } from '../src/actors/callback.js';
import {
  ActorRef,
  ActorSystem,
  createMachine,
  interpret
} from '../src/index.js';

describe('system', () => {
  it('should register an actor (implicit system)', (done) => {
    type MySystem = ActorSystem<{
      actors: {
        receiver: ActorRef<{ type: 'HELLO' }>;
      };
    }>;

    const machine = createMachine({
      id: 'parent',
      initial: 'a',
      states: {
        a: {
          invoke: [
            {
              src: fromCallback((_, receive) => {
                receive((event) => {
                  expect(event.type).toBe('HELLO');
                  done();
                });
              }),
              key: 'receiver'
            },
            {
              src: createMachine({
                id: 'childmachine',
                entry: (_ctx, _ev, { system }) => {
                  const receiver = (system as MySystem)?.get('receiver');

                  if (receiver) {
                    receiver.send({ type: 'HELLO' });
                  }
                }
              })
            }
          ]
        }
      }
    });

    interpret(machine).start();
  });
});
