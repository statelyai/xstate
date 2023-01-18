import { toggle, sequence } from '../src/patterns';
import { createMachine } from '../src/index.js';

describe('patterns', () => {
  describe('toggle pattern', () => {
    it('should produce a partial state machine with a binary toggle', () => {
      expect(toggle('on', 'off', 'SWITCH')).toEqual({
        on: { on: { SWITCH: 'off' } },
        off: { on: { SWITCH: 'on' } }
      });
    });
  });

  describe('sequence pattern', () => {
    it('should work with an array', () => {
      const seq = ['one', 'two', 'three', 'last'];

      const sequenceMachine = createMachine({
        id: 'sequence',
        ...sequence(seq)
      });

      expect(
        sequenceMachine.transition(seq[0], { type: 'NEXT' }).value
      ).toEqual(seq[1]);

      expect(
        sequenceMachine.transition(seq[1], { type: 'PREV' }).value
      ).toEqual(seq[0]);

      expect(
        sequenceMachine.transition(seq[seq.length - 1], { type: 'NEXT' }).value
      ).toEqual(seq[seq.length - 1]);

      expect(
        sequenceMachine.transition(seq[0], { type: 'PREV' }).value
      ).toEqual(seq[0]);
    });

    it('should customize the next/prev events', () => {
      const seq = ['one', 'two', 'three', 'last'];

      const sequenceMachine = createMachine({
        id: 'sequence',
        ...sequence(seq, {
          nextEvent: { type: 'FORWARD' },
          prevEvent: { type: 'BACK' }
        })
      });

      expect(
        sequenceMachine.transition(seq[0], { type: 'NEXT' }).value
      ).toEqual(seq[0]);

      expect(
        sequenceMachine.transition(seq[1], { type: 'PREV' }).value
      ).toEqual(seq[1]);

      expect(
        sequenceMachine.transition(seq[0], { type: 'FORWARD' }).value
      ).toEqual(seq[1]);

      expect(
        sequenceMachine.transition(seq[1], { type: 'BACK' }).value
      ).toEqual(seq[0]);
    });

    it('should allow next/prev events to be undefined', () => {
      const seq = ['one', 'two', 'three', 'last'];

      const sequenceMachine = createMachine({
        id: 'sequence',
        ...sequence(seq, {
          nextEvent: { type: 'FORWARD' },
          prevEvent: undefined
        })
      });

      expect(
        sequenceMachine.transition(seq[0], { type: 'FORWARD' }).value
      ).toEqual(seq[1]);

      expect(
        sequenceMachine.transition(seq[1], { type: 'BACK' }).value
      ).toEqual(seq[1]);

      const backSequenceMachine = createMachine({
        id: 'backSequence',
        ...sequence(seq, {
          nextEvent: undefined,
          prevEvent: { type: 'BACK' }
        })
      });

      expect(
        backSequenceMachine.transition(seq[0], { type: 'FORWARD' }).value
      ).toEqual(seq[0]);

      expect(
        backSequenceMachine.transition(seq[1], { type: 'BACK' }).value
      ).toEqual(seq[0]);
    });
  });
});
