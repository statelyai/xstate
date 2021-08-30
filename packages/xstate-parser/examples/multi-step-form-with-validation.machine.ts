import { assign, createMachine } from 'xstate';

export interface MultiStepFormMachineContext {
  beneficiaryInfo?: BeneficiaryInfo;
  dateInfo?: DateInfo;
  errorMessage?: string;
}

interface BeneficiaryInfo {
  name: string;
  amount: number;
  currency: string;
}

interface DateInfo {
  preferredData: string;
}

export type MultiStepFormMachineEvent =
  | {
      type: 'BACK';
    }
  | {
      type: 'CONFIRM_BENEFICIARY';
      info: BeneficiaryInfo;
    }
  | {
      type: 'CONFIRM_DATE';
      info: DateInfo;
    }
  | {
      type: 'CONFIRM';
    };

const multiStepFormMachine = createMachine<
  MultiStepFormMachineContext,
  MultiStepFormMachineEvent
>(
  {
    id: 'multiStepForm',
    initial: 'enteringBeneficiary',
    states: {
      enteringBeneficiary: {
        initial: 'idle',
        id: 'enteringBeneficiary',
        onDone: {
          target: 'enteringDate'
        },
        states: {
          idle: {
            exit: 'clearErrorMessage',
            on: {
              CONFIRM_BENEFICIARY: {
                target: 'submitting',
                actions: 'assignBeneficiaryInfoToContext'
              }
            }
          },
          submitting: {
            invoke: {
              src: 'validateBeneficiary',
              onDone: {
                target: 'complete'
              },
              onError: {
                target: 'idle',
                actions: 'assignErrorMessageToContext'
              }
            }
          },
          complete: { type: 'final' }
        }
      },
      enteringDate: {
        id: 'enteringDate',
        onDone: {
          target: 'confirming'
        },
        initial: 'idle',
        states: {
          idle: {
            exit: 'clearErrorMessage',
            on: {
              CONFIRM_DATE: {
                target: 'submitting',
                actions: 'assignDateToContext'
              },
              BACK: {
                target: '#enteringBeneficiary'
              }
            }
          },
          submitting: {
            invoke: {
              src: 'validateDate',
              onDone: {
                target: 'complete'
              },
              onError: {
                target: 'idle',
                actions: 'assignErrorMessageToContext'
              }
            }
          },
          complete: { type: 'final' }
        }
      },
      confirming: {
        onDone: {
          target: 'success'
        },
        initial: 'idle',
        states: {
          idle: {
            exit: 'clearErrorMessage',
            on: {
              CONFIRM: { target: 'submitting' },
              BACK: {
                target: '#enteringDate'
              }
            }
          },
          submitting: {
            invoke: {
              src: 'submitPayment',
              onDone: {
                target: 'complete'
              },
              onError: {
                target: 'idle',
                actions: 'assignErrorMessageToContext'
              }
            }
          },
          complete: { type: 'final' }
        }
      },
      success: {
        type: 'final'
      }
    }
  },
  {
    actions: {
      assignDateToContext: assign((context, event) => {
        if (event.type !== 'CONFIRM_DATE') return {};
        return {
          dateInfo: event.info
        };
      }),
      clearErrorMessage: assign((context) => ({
        errorMessage: undefined
      })),
      assignBeneficiaryInfoToContext: assign((context, event) => {
        if (event.type !== 'CONFIRM_BENEFICIARY') return {};
        return {
          beneficiaryInfo: event.info
        };
      }),
      assignErrorMessageToContext: assign((context, event: any) => {
        return {
          errorMessage: event.data?.message || 'An unknown error occurred'
        };
      })
    }
  }
);

export default multiStepFormMachine;
