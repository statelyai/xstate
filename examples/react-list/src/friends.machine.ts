import { createMachine, assign, spawn } from 'xstate';
import { friendMachine } from './friend.machine';

export interface ToggleContext {
  count: number;
}

export const friendsMachine = createMachine<any>({
  id: 'toggle',
  context: {
    friends: []
  },
  on: {
    'FRIENDS.ADD': {
      actions: assign<any, any>({
        friends: (ctx: any, e: any) =>
          ctx.friends.concat(
            spawn(
              friendMachine.withContext({
                name: e.name,
                email: ''
              })
            )
          )
      })
    }
  }
});
