import { assign } from '..';
import { MachineTypes, DynamicActionObject } from '../types';

export class AssignAction<T extends MachineTypes>
  implements DynamicActionObject<T> {
  public type = 'xstate.assign';
  public params: {
    assignments: Record<string, any>;
  };

  public constructor(assignments: {}) {
    this.params = { assignments };
  }

  public resolve(state, eventObject) {
    // being lazy again
    return assign<T>(this.params.assignments).resolve(state, eventObject);
  }
}
