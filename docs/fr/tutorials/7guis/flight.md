# Task 3: Flight Booker

This is the third of [The 7 Tasks from 7GUIs](https://eugenkiss.github.io/7guis/tasks#flight):

> Challenges: constraints.
>
> The task is to build a frame containing a combobox C with the two options “one-way flight” and “return flight”, two textfields T1 and T2 representing the start and return date, respectively, and a button B for submitting the selected flight. T2 is enabled iff C’s value is “return flight”. When C has the value “return flight” and T2’s date is strictly before T1’s then B is disabled. When a non-disabled textfield T has an ill-formatted date then T is colored red and B is disabled. When clicking B a message is displayed informing the user of his selection (e.g. “You have booked a one-way flight on 04.04.2014.”). Initially, C has the value “one-way flight” and T1 as well as T2 have the same (arbitrary) date (it is implied that T2 is disabled).
>
> The focus of Flight Booker lies on modelling constraints between widgets on the one hand and modelling constraints within a widget on the other hand. Such constraints are very common in everyday interactions with GUI applications. A good solution for Flight Booker will make the constraints clear, succinct and explicit in the source code and not hidden behind a lot of scaffolding.
>
> Flight Booker is directly inspired by the Flight Booking Java example in Sodium with the simplification of using textfields for date input instead of specialized date picking widgets as the focus of Flight Booker is not on specialized/custom widgets.

## Modeling

Overall, there's two possible states this form can be in: `editing` or `submitted`. We can model updating the `startDate`, `returnDate`, and `trip` fields by using events, with the constraint that these fields can only be edited when in the `editing` state. Additionally, the `returnDate` can only be edited when `trip` is `"roundTrip"`, and we can enforce that constraint by using a guard.

A `SET_TRIP` event controls the `trip` field, and can only be assigned in the `editing` state (try editing it in `submitted` - even if it's not disabled, it will not change). We can add the additional constraint that it must either be `"oneWay"` or `"roundTrip"`.

To transition from `editing` to `submitted`, a `SUBMIT` event needs to be sent. Validation occurs in this transition by using a guard to ensure that there is a `startDate` if the `trip` is `"oneWay"`, or that there is a `startDate` and `returnDate` if the `trip` is `"roundTrip"`.

::: tip TIP: Context vs. State
Notice that we decided not to model the machine with nested states for the `trip`, such as `editing.oneWay` or `editing.roundTrip`. The reason is simply that even though this is technically a finite state (and you are free to model it this way), it is also a contextual value that we need to read from in order to display the value in the `trip` select input: `context.trip`.

However, you _can_ model this using nested states, and it's a good exercise to try it on your own; it might even simplify some of the guard logic in the `SUBMIT` transition. Try it out:

```js
// ...
initial: 'oneWay',
states: {
  oneWay: {
    entry: assign({ trip: 'oneWay' }),
    // ...
  },
  roundTrip: {
    entry: assign({ trip: 'roundTrip' }),
    // ...
  }
},
// ...
```

:::

**States:**

- `"editing"` - the state where the flight booking information is being edited
- `"submitted"` - the state where the flight booking information has been submitted successfully, and no further changes can be made

**Context:**

```ts
interface FlightContext {
  startDate?: string;
  returnDate?: string;
  trip: 'oneWay' | 'roundTrip';
}
```

**Events:**

```ts
type FlightEvent =
  | {
      type: 'SET_TRIP';
      value: 'oneWay' | 'roundTrip';
    }
  | {
      type: 'startDate.UPDATE';
      value: string;
    }
  | {
      type: 'returnDate.UPDATE';
      value: string;
    }
  | { type: 'SUBMIT' };
```

## Coding

```js
import { createMachine, assign } from 'xstate';

export const flightMachine = createMachine({
  id: 'flight',
  initial: 'editing',
  context: {
    startDate: undefined,
    returnDate: undefined,
    trip: 'oneWay' // or 'roundTrip'
  },
  states: {
    editing: {
      on: {
        'startDate.UPDATE': {
          actions: assign({
            startDate: (_, event) => event.value
          })
        },
        'returnDate.UPDATE': {
          actions: assign({
            returnDate: (_, event) => event.value
          }),
          cond: (context) => context.trip === 'roundTrip'
        },
        SET_TRIP: {
          actions: assign({
            trip: (_, event) => event.value
          }),
          cond: (_, event) =>
            event.value === 'oneWay' || event.value === 'roundTrip'
        },
        SUBMIT: {
          target: 'submitted',
          cond: (context) => {
            if (context.trip === 'oneWay') {
              return !!context.startDate;
            } else {
              return (
                !!context.startDate &&
                !!context.returnDate &&
                context.returnDate > context.startDate
              );
            }
          }
        }
      }
    },
    submitted: {
      type: 'final'
    }
  }
});
```

## Result

<iframe
  src="https://codesandbox.io/embed/7guis-flight-ulux2?fontsize=14&hidenavigation=1&theme=dark"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="7GUIs: Flight"
  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
  sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
