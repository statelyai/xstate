import './style.css';
import { machine, withUndoRedo } from './machine.ts';
import { createActor } from 'xstate';

const logic = withUndoRedo(machine);
const actor = createActor(logic);
actor.subscribe((s) => console.log(s.context.items));
actor.start();
actor.send({ type: 'item.add', item: 'first' });
actor.send({ type: 'item.add', item: 'second' });
actor.send({ type: 'item.add', item: 'third' });
actor.send({ type: 'undo' });
actor.send({ type: 'undo' });
actor.send({ type: 'redo' });
