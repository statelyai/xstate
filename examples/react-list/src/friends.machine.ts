import { spawn, ActorRefFrom, actions } from 'xstate';
import { createModel } from 'xstate/lib/model';
import { friendMachine } from './friend.machine';

export interface ToggleContext {
  count: number;
}

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
  id: 'toggle',
  on: {
    'NEW_FRIEND.CHANGE': {
      actions: friendsModel.assign({
        newFriendName: (_, e) => e.name
      })
    },
    'FRIENDS.ADD': {
      cond: (_, e) => e.name.trim().length > 0,
      actions: friendsModel.assign({
        newFriendName: '',
        friends: (ctx, e) =>
          ctx.friends.concat(
            spawn(
              friendMachine.withContext({
                name: e.name,
                prevName: e.name
              })
            )
          )
      })
    },
    'FRIEND.REMOVE': {
      actions: [
        // Stop the friend actor to unsubscribe
        actions.stop((ctx, e) => ctx.friends[e.index]),
        // Remove the friend from the list by index
        friendsModel.assign({
          friends: (ctx, e) =>
            ctx.friends.filter((_, index) => index !== e.index)
        })
      ]
    }
  },
  // This ensures that the stop() action is called before
  // the assign() action in 'FRIEND.REMOVE'
  preserveActionOrder: true
});
