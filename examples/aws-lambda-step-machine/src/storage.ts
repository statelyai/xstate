/**
 * The handler talks to storage through this interface only, so the in-memory
 * adapter used by `pnpm start` and a DynamoDB adapter are interchangeable.
 */
export interface SnapshotStore<TSnapshot> {
  get(id: string): Promise<TSnapshot | undefined>;
  put(id: string, snapshot: TSnapshot): Promise<void>;
}

/** Runs offline. Good enough for local runs and unit tests. */
export function createMemoryStore<TSnapshot>(): SnapshotStore<TSnapshot> {
  const snapshots = new Map<string, string>();
  return {
    async get(id) {
      const stored = snapshots.get(id);
      return stored === undefined ? undefined : JSON.parse(stored);
    },
    async put(id, snapshot) {
      // Stored as JSON so the local adapter round-trips exactly like a real one.
      snapshots.set(id, JSON.stringify(snapshot));
    }
  };
}

/**
 * A DynamoDB adapter is the same two methods. Sketched rather than
 * implemented, so that the example runs with no AWS credentials:
 *
 * ```ts
 * import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
 * import {
 *   DynamoDBDocumentClient,
 *   GetCommand,
 *   PutCommand
 * } from '@aws-sdk/lib-dynamodb';
 *
 * export function createDynamoStore<TSnapshot>(
 *   table: string
 * ): SnapshotStore<TSnapshot> {
 *   const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
 *   return {
 *     async get(id) {
 *       const result = await client.send(
 *         new GetCommand({ TableName: table, Key: { id } })
 *       );
 *       return result.Item?.snapshot;
 *     },
 *     async put(id, snapshot) {
 *       await client.send(
 *         new PutCommand({ TableName: table, Item: { id, snapshot } })
 *       );
 *     }
 *   };
 * }
 * ```
 */
export type DynamoStoreSketch = never;
