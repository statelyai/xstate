import { ActorRefFrom, createMachine, assign, stop } from 'xstate';
import { friendMachine } from './friend.machine';

export const friendsMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QDMBOBLMA7CsDEAcgKIDqA+gGIBKAkkQQCIB0AwgBICCBA4kQNoAGALqJQABwD2sdABd0ErKJAAPRACYBapgDYAHAHYALAE4ja7foCsl-boA0IAJ6IBAX1cO0mHPmp1GAMpMHAwMgiJIIJLScgpKqggaWnpGpobmVjb2TogAjLkCTJbGJcbappYC2oYAzLnunhjYuHh+9MxURACyAPIAavzCStGy8oqRCUk6BiZmFta2Ds6J5Uz6pca5+gI7ljU1hu4eIFgSEHBKXs3wkSOx46AJAksuR65AA */
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
              id: `friend-${context.friends.length}`,
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
        stop(({ context, event }) => context.friends[event.index]),
        // Remove the friend from the list by index
        assign({
          friends: ({ context, event }) =>
            context.friends.filter((_, index) => index !== event.index)
        })
      ]
    }
  }
});
