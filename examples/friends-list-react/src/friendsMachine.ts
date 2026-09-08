import { types, ActorRefFrom, createMachine } from 'xstate';
import { friendMachine } from './friendMachine';

export const friendsMachine = createMachine({
  schemas: {
    context: types<{
      newFriendName: string;
      friends: { id: string; ref: ActorRefFrom<typeof friendMachine> }[];
    }>(),
    events: {
      'FRIENDS.ADD': types<{ name: string }>(),
      'NEW_FRIEND.CHANGE': types<{ name: string }>(),
      'FRIEND.REMOVE': types<{ index: number }>()
    }
  },
  context: { newFriendName: '', friends: [] },
  on: {
    'NEW_FRIEND.CHANGE': ({ context, event }) => ({
      context: { ...context, newFriendName: event.name }
    }),
    'FRIENDS.ADD': ({ context, event }, enq) => {
      if (!event.name.trim()) return;
      const id = crypto.randomUUID();
      const friend = enq.spawn(friendMachine, {
        id,
        input: { name: event.name }
      });
      return {
        context: {
          newFriendName: '',
          friends: [...context.friends, { id, ref: friend }]
        }
      };
    },
    'FRIEND.REMOVE': ({ context, event }, enq) => {
      const friend = context.friends[event.index];
      if (!friend) return;
      enq.stop(friend.ref);
      return {
        context: {
          ...context,
          friends: context.friends.filter((_, index) => index !== event.index)
        }
      };
    }
  }
});
