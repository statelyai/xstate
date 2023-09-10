import { createActor, createMachine, ActorRefFrom } from 'xstate';

const baseUrl = `https://example.com`;

const machine = createMachine({
  id: 'call',
  initial: 'intro',
  states: {
    intro: {
      on: {
        'DTMF-1': 'mainStLocation',
        'DTMF-2': 'broadwayLocation'
      },
      meta: {
        ncco: [
          {
            action: 'talk',
            text: "Hi. You've reached Joe's Restaurant! Springfield's top restaurant chain!"
          },
          { action: 'talk', text: 'Please select one of our locations.' },
          { action: 'talk', text: 'Press 1 for our Main Street location.' },
          { action: 'talk', text: 'Press 2 for our Broadway location.' },
          { action: 'input', eventUrl: [`${baseUrl}/dtmf`], maxDigits: 1 }
        ]
      }
    },
    mainStLocation: {
      on: {
        'DTMF-1': 'mainStReservation',
        'DTMF-2': 'mainStHours'
      },
      meta: {
        ncco: [
          {
            action: 'talk',
            text: "Joe's Main Street is located at Main Street number 11, Springfield."
          },
          { action: 'talk', text: 'Press 1 to make a reservation.' },
          { action: 'talk', text: 'Press 2 to hear our operating hours.' },
          { action: 'input', eventUrl: [`${baseUrl}/dtmf`], maxDigits: 1 }
        ]
      }
    },
    broadwayLocation: {
      on: {
        'DTMF-1': 'broadwayReservation',
        'DTMF-2': 'broadwayHours'
      },
      meta: {
        ncco: [
          {
            action: 'talk',
            text: "Joe's Broadway is located at Broadway number 46, Springfield."
          },
          { action: 'talk', text: 'Press 1 to make a reservation.' },
          { action: 'talk', text: 'Press 2 to hear our operating hours.' },
          { action: 'input', eventUrl: [`${baseUrl}/dtmf`], maxDigits: 1 }
        ]
      }
    },
    mainStReservation: {
      meta: {
        ncco: [
          {
            action: 'talk',
            text: 'Transferring you to take your reservation.'
          },
          {
            action: 'connect',
            from: '15557654321',
            endpoint: [{ type: 'phone', number: '15551357913' }]
          }
        ]
      }
    },
    mainStHours: {
      on: {
        'DTMF-1': 'mainStHours',
        'DTMF-2': 'mainStReservation',
        'DTMF-3': 'broadwayLocation'
      },
      meta: {
        ncco: [
          {
            action: 'talk',
            text: "Joe's Main Street is open Monday through Friday, 8am to 8pm."
          },
          { action: 'talk', text: 'Saturday and Sunday 9am to 7pm.' },
          { action: 'talk', text: 'Press 1 to hear this information again.' },
          { action: 'talk', text: 'Press 2 to make a reservation.' },
          { action: 'talk', text: 'Press 3 for our Broadway location.' },
          { action: 'input', eventUrl: [`${baseUrl}/dtmf`], maxDigits: 1 }
        ]
      }
    },
    broadwayReservation: {
      meta: {
        ncco: [
          {
            action: 'talk',
            text: 'Transferring you to take your reservation.'
          },
          {
            action: 'connect',
            from: '15557654321',
            endpoint: [{ type: 'phone', number: '15552468024' }]
          }
        ]
      }
    },
    broadwayHours: {
      on: {
        'DTMF-1': 'broadwayHours',
        'DTMF-2': 'broadwayReservation',
        'DTMF-3': 'mainStLocation'
      },
      meta: {
        ncco: [
          {
            action: 'talk',
            text: "Joe's Broadway is open Monday through Sunday, 10am to 11pm."
          },
          { action: 'talk', text: 'Press 1 to hear this information again.' },
          { action: 'talk', text: 'Press 2 to make a reservation.' },
          { action: 'talk', text: 'Press 3 for our Main Street location.' },
          { action: 'input', eventUrl: [`${baseUrl}/dtmf`], maxDigits: 1 }
        ]
      }
    }
  }
});

interface Call {
  service: ActorRefFrom<typeof machine>;
}

class CallManager {
  calls: Record<string, Call> = {};

  createCall(uuid: string) {
    const service = createActor(machine).start();
    this.calls[uuid] = { service };
  }

  updateCall(uuid: string, event: any) {
    const call = this.calls[uuid];
    if (call) {
      call.service.send(event);
    }
  }

  getNcco(uuid: string) {
    const call = this.calls[uuid];
    if (!call) {
      return [];
    }
    return call.service.getSnapshot().meta[
      `${call.service.id}.${call.service.getSnapshot().value}`
    ].ncco;
  }

  endCall(uuid: string) {
    delete this.calls[uuid];
  }
}

export const callManager = new CallManager();
