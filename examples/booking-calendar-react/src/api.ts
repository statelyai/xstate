export interface Slot {
  id: string;
  time: string;
  taken: boolean;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stands in for a server. `10:30` is booked by "someone else" on confirm. */
const CONFLICTING_SLOT = 'slot-3';

export const fetchSlots = async (): Promise<Slot[]> => {
  await wait(600);
  return [
    { id: 'slot-1', time: '09:00', taken: false },
    { id: 'slot-2', time: '09:45', taken: true },
    { id: 'slot-3', time: '10:30', taken: false },
    { id: 'slot-4', time: '11:15', taken: false },
    { id: 'slot-5', time: '13:00', taken: false }
  ];
};

export const confirmBooking = async (slotId: string): Promise<string> => {
  await wait(600);

  if (slotId === CONFLICTING_SLOT) {
    throw new Error('That slot was just booked by someone else.');
  }

  return `CONF-${slotId.toUpperCase()}`;
};
