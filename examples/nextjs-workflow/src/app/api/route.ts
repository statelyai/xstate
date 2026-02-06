export const dynamic = 'force-dynamic'; // defaults to force-static
import { cookies } from 'next/headers';
import { kv } from '@vercel/kv';
import { AnyEventObject, createActor, createMachine, waitFor } from 'xstate';

const machine = createMachine({
  initial: 'green',
  states: {
    green: {
      on: { NEXT: 'yellow' }
    },
    yellow: {
      on: { NEXT: 'red' }
    },
    red: {
      on: { NEXT: 'green' }
    }
  }
});

export async function GET(request: Request) {
  const cookieStore = cookies();
  const jsonState = await kv.get('state');

  if (jsonState) {
    try {
      const state = machine.resolveState(jsonState);
      console.log(state);
      // return JSON response
      return Response.json(state);
    } catch (e) {
      console.log(e);
    }
  } else {
    return new Response('Hello World!');
  }
}

export async function POST(request: Request) {
  // get event object from request body
  const eventObject = (await request.json()) as AnyEventObject;

  const jsonState = await kv.get('state');

  console.log(jsonState);

  const actor = createActor(machine, {
    snapshot: jsonState
  });

  actor.start();

  console.log(eventObject);

  actor.send(eventObject);

  // cookieStore.set('state', JSON.stringify(actor.getSnapshot()));
  await kv.set('state', actor.getSnapshot());

  console.log(actor.getSnapshot());
}
