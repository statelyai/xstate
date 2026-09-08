import { createMachine, createAsyncLogic } from 'xstate';
// https://github.com/serverlessworkflow/specification/tree/main/examples#Event-Based-Transitions-Example
export const workflow = createMachine({
  delays: {
    visaDecisionTimeout: 1000
  },
  actors: {
    handleApprovedVisaWorkflowID: createAsyncLogic({
      run: async () => {
        console.log('handleApprovedVisaWorkflowID workflow started');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('handleApprovedVisaWorkflowID workflow completed');
      }
    }),
    handleRejectedVisaWorkflowID: createAsyncLogic({
      run: async () => {
        console.log('handleRejectedVisaWorkflowID workflow started');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('handleRejectedVisaWorkflowID workflow completed');
      }
    }),
    handleNoVisaDecisionWorkflowId: createAsyncLogic({
      run: async () => {
        console.log('handleNoVisaDecisionWorkflowId workflow started');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('handleNoVisaDecisionWorkflowId workflow completed');
      }
    })
  },
  id: 'eventbasedswitchstate',
  initial: 'CheckVisaStatus',
  states: {
    CheckVisaStatus: {
      on: {
        visaApprovedEvent: { target: 'HandleApprovedVisa' },
        visaRejectedEvent: { target: 'HandleRejectedVisa' }
      },
      after: {
        visaDecisionTimeout: { target: 'HandleNoVisaDecision' }
      }
    },
    HandleApprovedVisa: {
      invoke: {
        src: 'handleApprovedVisaWorkflowID',
        onDone: { target: 'End' }
      }
    },
    HandleRejectedVisa: {
      invoke: {
        src: 'handleRejectedVisaWorkflowID',
        onDone: { target: 'End' }
      }
    },
    HandleNoVisaDecision: {
      invoke: {
        src: 'handleNoVisaDecisionWorkflowId',
        onDone: { target: 'End' }
      }
    },
    End: {
      type: 'final'
    }
  }
});
