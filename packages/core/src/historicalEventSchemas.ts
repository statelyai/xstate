import type { MachineEventSchema } from './machineVersion.types.ts';

// Machine histories include internal/runtime events that public input excludes.
export const historicalEventSchemas = new WeakMap<object, MachineEventSchema>();
