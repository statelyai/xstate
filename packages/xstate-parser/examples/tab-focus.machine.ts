import { assign, createMachine, Sender } from 'xstate';

export interface TabFocusMachineContext {}

export type TabFocusMachineEvent =
  | {
      type: 'REPORT_TAB_BLUR';
    }
  | {
      type: 'REPORT_TAB_FOCUS';
    };

const tabFocusMachine = createMachine<
  TabFocusMachineContext,
  TabFocusMachineEvent
>(
  {
    id: 'tabFocus',
    initial: 'userIsOnTab',
    states: {
      userIsOnTab: {
        invoke: {
          src: 'checkForDocumentBlur'
        },
        on: {
          REPORT_TAB_BLUR: { target: 'userIsNotOnTab' }
        }
      },
      userIsNotOnTab: {
        invoke: {
          src: 'checkForDocumentFocus'
        },
        on: {
          REPORT_TAB_FOCUS: { target: 'userIsOnTab' }
        }
      }
    }
  },
  {
    services: {
      checkForDocumentBlur: () => (send: Sender<TabFocusMachineEvent>) => {
        const listener = () => {
          send('REPORT_TAB_BLUR');
        };

        window.addEventListener('blur', listener);

        return () => {
          window.removeEventListener('blur', listener);
        };
      },
      checkForDocumentFocus: () => (send: Sender<TabFocusMachineEvent>) => {
        const listener = () => {
          send('REPORT_TAB_FOCUS');
        };

        window.addEventListener('focus', listener);

        return () => {
          window.removeEventListener('focus', listener);
        };
      }
    }
  }
);

export default tabFocusMachine;
