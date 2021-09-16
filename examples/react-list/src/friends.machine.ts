import { spawn, ActorRefFrom, actions } from 'xstate';
import { createModel } from 'xstate/lib/model';
import { friendMachine } from './friend.machine';

const friendsModel = createModel(
  {
    newFriendName: '',
    friends: [] as ActorRefFrom<typeof friendMachine>[]
  },
  {
    events: {
      'FRIENDS.ADD': (name: string) => ({ name }),
      'NEW_FRIEND.CHANGE': (name: string) => ({ name }),
      'FRIEND.REMOVE': (index: number) => ({ index })
    }
  }
);

export const friendsMachine = friendsModel.createMachine({
  id: 'friends',
  on: {
    'NEW_FRIEND.CHANGE': {
      actions: friendsModel.assign({
        newFriendName: (_, event) => event.name
      })
    },
    'FRIENDS.ADD': {
      cond: (_, event) => event.name.trim().length > 0,
      actions: friendsModel.assign({
        friends: (context) =>
          context.friends.concat(
            spawn(
              friendMachine.withContext({
                name: context.newFriendName,
                prevName: context.newFriendName
              }),
              `friend-${context.friends.length}`
            )
          ),
        newFriendName: ''
      })
    },
    'FRIEND.REMOVE': {
      actions: [
        // Stop the friend actor to unsubscribe
        actions.stop((context, event) => context.friends[event.index]),
        // Remove the friend from the list by index
        friendsModel.assign({
          friends: (context, event) =>
            context.friends.filter((_, index) => index !== event.index)
        })
      ]
    }
  },
  // This ensures that the stop() action is called before
  // the assign() action in 'FRIEND.REMOVE'
  preserveActionOrder: true
});
