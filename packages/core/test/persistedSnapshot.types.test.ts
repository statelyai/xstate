import { createActor, createMachine } from '../src';
import type { Snapshot } from '../src';

describe('persisted snapshot round-trip types', () => {
  it('should round-trip getPersistedSnapshot into createActor without a cast', () => {
    const machine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const snapshot = createActor(machine).getPersistedSnapshot();

    createActor(machine, { snapshot });
  });

  it('should round-trip a versioned machine snapshot without a cast', () => {
    const machine = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'a',
      states: { a: {} }
    });

    const snapshot = createActor(machine).getPersistedSnapshot();

    createActor(machine, { snapshot });
  });

  it('should accept a snapshot persisted from a different version of the same machine (migration path)', () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'a',
      states: { a: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      initial: 'a',
      states: { a: {} }
    });

    const snapshot = createActor(checkoutV1).getPersistedSnapshot();

    createActor(checkoutV2, { snapshot });
  });

  it('should reject a snapshot persisted from a machine with a different ID', () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'a',
      states: { a: {} }
    });
    const cart = createMachine({
      id: 'cart',
      version: '1',
      initial: 'a',
      states: { a: {} }
    });

    const snapshot = createActor(checkout).getPersistedSnapshot();

    createActor(cart, {
      // @ts-expect-error
      snapshot
    });
  });

  it('should accept a revived (unbranded) snapshot', () => {
    const machine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const revived = JSON.parse(
      JSON.stringify(createActor(machine).getPersistedSnapshot())
    ) as Snapshot<unknown>;

    createActor(machine, { snapshot: revived });
  });

  it('should be usable where a plain Snapshot<unknown> is expected', () => {
    const machine = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'a',
      states: { a: {} }
    });

    const snapshot: Snapshot<unknown> =
      createActor(machine).getPersistedSnapshot();
    snapshot satisfies Snapshot<unknown>;
  });
});
