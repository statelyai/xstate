import { InspectionEvent, assertEvent } from './packages/core/src/index.ts';

function test(event: InspectionEvent) {
  assertEvent(event, '@xstate.event');
  console.log(event.event);
}

function test2<TEVENT extends InspectionEvent>(event: TEVENT) {
  assertEvent(event, '@xstate.event');
  console.log(event.event);
}
