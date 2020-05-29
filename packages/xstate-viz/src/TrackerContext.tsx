import { createContext } from 'react';
import { Tracker } from './tracker';

export const TrackerContext = createContext<Tracker>(null as any);
