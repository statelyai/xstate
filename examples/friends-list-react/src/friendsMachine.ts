import { ActorRefFrom, createMachine } from 'xstate';
import { friendMachine } from './friendMachine';

const makeId = () => Math.random().toString(36).substring(7);

export const friendsMachine = createMachine({
  types: {} as {
    context: {
      newFriendName: string;
      friends: ActorRefFrom<typeof friendMachine>[];
    };
    events:
      | {
          type: 'FRIENDS.ADD';
          name: string;
        }
      | {
          type: 'NEW_FRIEND.CHANGE';
          name: string;
        }
      | {
          type: 'FRIEND.REMOVE';
          index: number;
        };
  },
  id: 'friends',
  context: {
    newFriendName: '',
    friends: []
  },
  on: {
    'NEW_FRIEND.CHANGE': ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          newFriendName: (({ event }) => event.name)({
            context: context,
            event: event
          })
        }
      };
    },
    'FRIENDS.ADD': ({ context, event, guards, actions }, enq) => {
      if (!(({ event }) => event.name.trim().length > 0)({ context, event })) {
        return;
      }
      const friend = enq.spawn(friendMachine, {
        id: `friend-${makeId()}`,
        input: {
          name: context.newFriendName
        }
      });
      return {
        context: {
          ...context,
          friends: context.friends.concat(friend),
          newFriendName: ''
        }
      };
    },
    'FRIEND.REMOVE': ({ context, event, guards, actions }, enq) => {
      enq.stop(context.friends[event.index]);
      return {
        context: {
          ...context,
          friends: (({ context, event }) =>
            context.friends.filter((_, index) => index !== event.index))({
            context: context,
            event: event
          })
        }
      };
    }
  }
});
