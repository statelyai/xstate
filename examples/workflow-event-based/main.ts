import { createMachine, fromPromise, interpret } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#Event-Based-Transitions-Example
export const workflow = createMachine(
  {
    id: 'eventbasedswitchstate',
    initial: 'CheckVisaStatus',
    states: {
      CheckVisaStatus: {
        on: {
          visaApprovedEvent: 'HandleApprovedVisa',
          visaRejectedEvent: 'HandleRejectedVisa'
        },
        after: {
          visaDecisionTimeout: 'HandleNoVisaDecision'
        }
      },
      HandleApprovedVisa: {
        invoke: {
          src: 'handleApprovedVisaWorkflowID',
          onDone: 'End'
        }
      },
      HandleRejectedVisa: {
        invoke: {
          src: 'handleRejectedVisaWorkflowID',
          onDone: 'End'
        }
      },
      HandleNoVisaDecision: {
        invoke: {
          src: 'handleNoVisaDecisionWorkflowId',
          onDone: 'End'
        }
      },
      End: {
        type: 'final'
      }
    }
  },
  {
    delays: {
      visaDecisionTimeout: 1000
    },
    actors: {
      handleApprovedVisaWorkflowID: fromPromise(async () => {
        console.log('handleApprovedVisaWorkflowID workflow started');

        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('handleApprovedVisaWorkflowID workflow completed');
      }),
      handleRejectedVisaWorkflowID: fromPromise(async () => {
        console.log('handleRejectedVisaWorkflowID workflow started');

        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('handleRejectedVisaWorkflowID workflow completed');
      }),
      handleNoVisaDecisionWorkflowId: fromPromise(async () => {
        console.log('handleNoVisaDecisionWorkflowId workflow started');

        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('handleNoVisaDecisionWorkflowId workflow completed');
      })
    }
  }
);

const actor = interpret(workflow);

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

actor.send({
  type: 'visaApprovedEvent'
});
