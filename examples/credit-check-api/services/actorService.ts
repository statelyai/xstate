import * as mongoDB from "mongodb";
import { AnyStateMachine, createActor } from "xstate";

// mongoDB collections
export const collections: {
  machineStates?: mongoDB.Collection;
  creditReports?: mongoDB.Collection;
  creditProfiles?: mongoDB.Collection;
} = {};

// Initialize DB Connection and Credit Check Actor
export async function initDbConnection() {
  try {
    //example uri
    //const uri = "mongodb://localhost:27017/creditCheck";
    const uri = "<your mongo uri here>/creditCheck";
    const client = new mongoDB.MongoClient(uri, {
      serverApi: mongoDB.ServerApiVersion.v1,
    });
    const db = client.db("creditCheck");
    collections.machineStates = db.collection("machineStates");
    await client.connect();
  } catch (err) {
    console.log("Error connecting to the db...", err);
    throw err;
  }
}

// create an actor to be used in the API endpoints
// hydrate the actor if a workflowId is provided
// otherwise, create a new workflowId
// persist the actor state to the db
export async function getDurableActor({
  machine,
  workflowId,
}: {
  machine: AnyStateMachine;
  workflowId?: string;
}) {
  let restoredState;
  // if workflowId is provided, hydrate the actor with the persisted state from the db
  // otherwise, just create a new workflowId
  if (workflowId) {
    restoredState = await collections.machineStates?.findOne({
      workflowId,
    });

    if (!restoredState) {
      throw new Error("Actor not found with the provided workflowId");
    }

    console.log("restored state", restoredState);
  } else {
    workflowId = generateActorId();
  }

  // create the actor, a null snapshot will cause the actor to start from the initial state
  const actor = createActor(machine, {
    snapshot: restoredState?.persistedState,
  });

  // subscribe to the actor to persist the state to the db
  actor.subscribe({
    next: async () => {
      // on transition, persist the most recent actor state to the db
      // be sure to enable upsert so that the state record is created if it doesn't exist!
      const persistedState = actor.getPersistedSnapshot();
      console.log("persisted state", persistedState);
      const result = await collections.machineStates?.replaceOne(
        {
          workflowId,
        },
        {
          workflowId,
          persistedState,
        },
        { upsert: true }
      );

      if (!result?.acknowledged) {
        throw new Error(
          "Error persisting actor state. Verify db connection is configured correctly."
        );
      }
    },
    error: (err) => {
      console.log("Error in actor subscription: " + err);
      throw err;
    },
    complete: async () => {
      console.log("Actor is finished!");
      actor.stop();
    },
  });
  actor.start();

  return { actor, workflowId };
}

function generateActorId() {
  return Math.random().toString(36).substring(2, 8);
}
