import { ActorRefFrom, createMachine, assign, stopChild } from 'xstate';
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
    'NEW_FRIEND.CHANGE': {
      actions: assign({
        newFriendName: ({ event }) => event.name
      })
    },
    'FRIENDS.ADD': {
      guard: ({ event }) => event.name.trim().length > 0,
      actions: assign({
        friends: ({ context, spawn }) =>
          context.friends.concat(
            spawn(friendMachine, {
              id: `friend-${makeId()}`,
              input: {
                name: context.newFriendName
              }
            })
          ),
        newFriendName: ''
      })
    },
    'FRIEND.REMOVE': {
      actions: [
        // Stop the friend actor to unsubscribe
        stopChild(({ context, event }) => context.friends[event.index]),
        // Remove the friend from the list by index
        assign({
          friends: ({ context, event }) =>
            context.friends.filter((_, index) => index !== event.index)
        })
      ]
    }
  }
});
