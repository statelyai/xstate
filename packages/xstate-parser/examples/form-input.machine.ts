import { assign, createMachine, Sender } from 'xstate';

export interface FormInputMachineContext {
  value: Value;
  errorMessage?: string;
}

type Value = any;

export type FormInputMachineEvent =
  | {
      type: 'CHANGE';
      value: Value;
    }
  | {
      type: 'BLUR';
    }
  | {
      type: 'FOCUS';
    }
  | {
      type: 'DISABLE';
    }
  | {
      type: 'ENABLE';
    }
  | {
      type: 'REPORT_INVALID';
      reason: string;
    };

const formInputMachine = createMachine<
  FormInputMachineContext,
  FormInputMachineEvent
>(
  {
    id: 'formInput',
    initial: 'active',
    states: {
      active: {
        on: {
          DISABLE: { target: 'disabled' }
        },
        type: 'parallel',
        states: {
          focus: {
            initial: 'unfocused',
            states: {
              focused: {
                on: {
                  BLUR: { target: 'unfocused' }
                }
              },
              unfocused: {
                on: {
                  FOCUS: { target: 'focused' }
                }
              }
            }
          },
          validation: {
            initial: 'pending',
            on: {
              CHANGE: {
                target: '.pending',
                actions: 'assignValueToContext'
              }
            },
            states: {
              pending: {
                on: {
                  REPORT_INVALID: {
                    target: 'invalid',
                    actions: 'assignReasonToErrorMessage'
                  }
                },
                invoke: {
                  src: 'validateField',
                  onDone: { target: 'valid' }
                }
              },
              valid: {},
              invalid: {}
            }
          }
        }
      },
      disabled: {
        on: {
          ENABLE: { target: 'active' }
        }
      }
    }
  },
  {
    actions: {
      assignReasonToErrorMessage: assign((context, event) => {
        if (event.type !== 'REPORT_INVALID') return {};
        return {
          errorMessage: event.reason
        };
      }),
      assignValueToContext: assign((context, event) => {
        if (event.type !== 'CHANGE') return {};
        return {
          value: event.value
        };
      })
    },
    services: {
      validateField: (context) => (send: Sender<FormInputMachineEvent>) => {
        if (context.value === '') {
          send({
            type: 'REPORT_INVALID',
            reason: 'Value cannot be empty'
          });
        }
      }
    }
  }
);

export default formInputMachine;
