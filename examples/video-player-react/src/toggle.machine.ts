import { createMachine, assign } from 'xstate';

export interface ToggleContext {
  count: number;
}

export const toggleMachine = createMachine<ToggleContext>({
  /** @xstate-layout N4IgpgJg5mDOIC5QBcD2UoBswDoCWAdgIYDGyeAbmAMQAqA8gOKMAyAogNoAMAuoqAAdUsPOVQF+IAB6IAjAE4AHABoQAT0QAmRQDYcOg4aOGAzAF8zqtBmw5S5KnSatOvSUJFiJSaXKWqNBAU9Y1DDCyt0LFx7Sho2KgJkAAJNbj4fD1E8cUkZBBN5EwDEEwAWMotLEAJUCDhJa2j3YWzcn3zZTRKgzQiQJttCWKoWzxzvUHydLh7NLnNqwZiyOLG2yd8Cstn1OR0AVn7lnAA5MAB3ZNhkImQwZNl1rzzSxVkencqqoA */
  id: 'toggle',
  initial: 'inactive',
  context: {
    count: 0
  },
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },

    active: {
      entry: "inline:toggle.active#entry[0]",
      on: {
        TOGGLE: 'inactive',
        "Event 2": "New state 1"
      }
    },

    "New state 1": {}
  }
});
