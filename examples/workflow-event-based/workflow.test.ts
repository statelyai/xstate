import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { workflow } from './workflow.ts';
const actors: { stop(): unknown }[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  for (const actor of actors.splice(0)) actor.stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it.each(['visaApprovedEvent', 'visaRejectedEvent', null])(
  'handles decision %s',
  async (type) => {
    const actor = createActor(workflow).start();
    actors.push(actor);
    if (type) actor.send({ type });
    await vi.advanceTimersByTimeAsync(2000);
    expect(actor.getSnapshot().status).toBe('done');
    const name =
      type === 'visaApprovedEvent'
        ? 'handleApprovedVisaWorkflowID'
        : type === 'visaRejectedEvent'
          ? 'handleRejectedVisaWorkflowID'
          : 'handleNoVisaDecisionWorkflowId';
    expect(console.log).toHaveBeenCalledWith(name + ' workflow completed');
  }
);
