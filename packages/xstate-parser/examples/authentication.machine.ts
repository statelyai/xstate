import { assign, createMachine, Sender } from 'xstate';

export type AuthenticationMachineContext = {
  userDetails?: UserDetails;
};

interface UserDetails {
  username: string;
}

export type AuthenticationMachineEvent =
  | {
      type: 'REPORT_IS_LOGGED_IN';
      userDetails: UserDetails;
    }
  | {
      type: 'REPORT_IS_LOGGED_OUT';
    }
  | {
      type: 'LOG_OUT';
    }
  | {
      type: 'LOG_IN';
      userDetails: UserDetails;
    };

const authenticationMachine = createMachine<
  AuthenticationMachineContext,
  AuthenticationMachineEvent
>(
  {
    id: 'authentication',
    initial: 'checkingIfLoggedIn',
    states: {
      checkingIfLoggedIn: {
        invoke: {
          src: 'checkIfLoggedIn',
          onError: {
            target: 'loggedOut'
          }
        },
        on: {
          REPORT_IS_LOGGED_IN: {
            target: 'loggedIn',
            actions: 'assignUserDetailsToContext'
          },
          REPORT_IS_LOGGED_OUT: { target: 'loggedOut' }
        }
      },
      loggedIn: {
        on: {
          LOG_OUT: {
            target: 'loggedOut'
          }
        }
      },
      loggedOut: {
        entry: ['navigateToAuthPage', 'clearUserDetailsFromContext'],
        on: {
          LOG_IN: {
            target: 'loggedIn',
            actions: 'assignUserDetailsToContext'
          }
        }
      }
    }
  },
  {
    services: {
      checkIfLoggedIn: () => async (
        send: Sender<AuthenticationMachineEvent>
      ) => {
        // Perform some async check here
        // if (isLoggedIn) {
        //   send({
        //     type: "REPORT_IS_LOGGED_IN",
        //     userDetails: {
        //       username: "mpocock1",
        //     },
        //   });
        // } else {
        //   send({
        //     type: "REPORT_IS_LOGGED_OUT",
        //   });
        // }
      }
    },
    actions: {
      navigateToAuthPage: () => {
        // When the user is logged out, we
        // should take them to the /auth route
      },
      assignUserDetailsToContext: assign((context, event) => {
        if (event.type !== 'REPORT_IS_LOGGED_IN') {
          return {};
        }
        return {
          userDetails: event.userDetails
        };
      }),
      clearUserDetailsFromContext: assign((context) => ({
        userDetails: undefined
      }))
    }
  }
);

export default authenticationMachine;
