# Persistent State Storage and Hydration with MongoDB

## What it is

This example demonstrates how to hook the MongoDB client into your running state machine for persistence.
Specifically, it connects to a running instance of a MongoDB service, saves a snapshot of the Actor's state in the DB, and retrieves it whenever the Actor receives an event.
The Actor is bound to a single record in the database, and will only ever update that record.
If one doesn't already exist, like in the case of a first run, we create the state file in the database.
This is particularly useful for working through long-running stateful flows, or flows where the underlying compute is not promised to be consistent.

> [!IMPORTANT]
>
> This example is intended to be used as a starting point. It is not production-ready. For example, when connecting to the MongoDB client, all strings should be URI-encoded when authenticating to MongoDB. Check out [MongoDB's Node driver docs](https://www.mongodb.com/docs/drivers/node/current/fundamentals/authentication/mechanisms/) for more details.

## Prerequisites

To get this sample working, you'll need the following:

- A live [MongoDB database deployment](https://www.mongodb.com/docs/atlas/create-connect-deployments/). There is no need to explicitly create the collections in the deployment. If they don't exist, the MongoClient will create them on your behalf.
- A connection string to the running database. This is obtained by selecting the Connect option if you're using MongoDB's Atlas service

## Running the sample

1. Open a terminal in this folder and run `yarn install`. This will install the beta version of XState v5, the proper Node.JS driver for MongoDB, and `ts-node` for running this sample in your terminal.

2. Replace the following line with your own connection string, or load it in as an environment variable:

```ts
const uri = '<your mongodb connection string>';
```

3. Run the following command in the terminal to start the project:

```
yarn ts-node --esm ./main.ts
```

And that's it! Feel free to send the machine events, killing the program between events, and restarting it to ensure it hydrates properly. Be sure to check your Mongo DB collection for changes!
