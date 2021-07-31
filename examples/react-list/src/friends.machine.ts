import { assign, spawn, ActorRefFrom } from 'xstate';
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
      'FRIEND.REMOVE': () => ({})
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
    }
  }
});
