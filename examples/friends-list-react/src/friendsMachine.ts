import { ActorFromLogic, setup, types } from 'xstate';
import { friendMachine } from './friendMachine';

const makeId = () => Math.random().toString(36).substring(7);

export const friendsMachine = setup({
  schemas: {
    context: types<{
      newFriendName: string;
      friends: ActorFromLogic<typeof friendMachine>[];
    }>(),
    events: {
      'FRIENDS.ADD': types<{ name: string }>(),
      'NEW_FRIEND.CHANGE': types<{ name: string }>(),
      'FRIEND.REMOVE': types<{ index: number }>()
    }
  }
}).createMachine({
  id: 'friends',
  context: {
    newFriendName: '',
    friends: []
  },
  on: {
    'NEW_FRIEND.CHANGE': ({ event }) => ({
      context: { newFriendName: event.name }
    }),
    'FRIENDS.ADD': ({ context, event }, enq) => {
      if (!event.name.trim().length) {
        return;
      }

      // Each friend is its own actor, spawned into the parent's context
      const friend = enq.spawn(friendMachine, {
        id: `friend-${makeId()}`,
        input: { name: context.newFriendName }
      });

      return {
        context: {
          friends: context.friends.concat(friend),
          newFriendName: ''
        }
      };
    },
    'FRIEND.REMOVE': ({ context, event }, enq) => {
      enq.stop(context.friends[event.index]);

      return {
        context: {
          friends: context.friends.filter((_, index) => index !== event.index)
        }
      };
    }
  }
});
