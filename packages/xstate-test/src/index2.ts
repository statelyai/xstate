import type { StateMachine } from 'xstate';
import { TestPlan } from './types';

export function getShortestPathPlans<
  TMachine extends StateMachine<any, any, any>
>(machine: TMachine): Array<TestPlan<any, any>> {}

export function getSimplePathPlans<
  TMachine extends StateMachine<any, any, any>
>(machine: TMachine): Array<TestPlan<any, any>> {}

const plans = generateShortestPaths(machine, { until: transitionsCovered() });
