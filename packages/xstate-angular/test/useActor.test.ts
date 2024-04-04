import { useActor } from '../src/index.ts';
import { createMachine } from 'xstate';
import { isSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

describe('@xstate/angular', () => {
  const machine = createMachine({
    initial: 'inactive',
    states: {
      inactive: {
        on: {
          TOGGLE: 'active'
        }
      },
      active: {
        on: {
          TOGGLE: 'inactive'
        }
      }
    }
  });

  it('creates an actor as injectable service', () => {
    const ToggleActor = useActor(machine);
    TestBed.configureTestingModule({ providers: [ToggleActor] });
    const actor = TestBed.inject(ToggleActor);
    expect(isSignal(actor.snapshot)).toBe(true);
  });

  it('creates an actor that is provided in root when providedIn option is specified', () => {
    const ToggleActor = useActor(machine, { providedIn: 'root' });

    const store1 = TestBed.inject(ToggleActor);
    const store2 = TestBed.inject(ToggleActor);

    expect(store1).toBe(store2);
    expect(isSignal(store1.snapshot)).toBe(true);
  });

  it('update snapshot value', () => {
    const ToggleActor = useActor(machine, { providedIn: 'root' });
    const store1 = TestBed.inject(ToggleActor);
    expect(store1.snapshot().value).toBe('inactive');
    store1.send({ type: 'TOGGLE' });
    expect(store1.snapshot().value).toBe('active');
  });
});
