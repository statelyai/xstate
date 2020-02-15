# Task 2: Temperature

This is the second of [The 7 Tasks from 7GUIs](https://eugenkiss.github.io/7guis/tasks#temp):

> Challenges: bidirectional data flow, user-provided text input.
>
> The task is to build a frame containing two textfields TC and TF representing the temperature in Celsius and Fahrenheit, respectively. Initially, both TC and TF are empty. When the user enters a numerical value into TC the corresponding value in TF is automatically updated and vice versa. When the user enters a non-numerical string into TC the value in TF is not updated and vice versa. The formula for converting a temperature C in Celsius into a temperature F in Fahrenheit is C = (F - 32) \* (5/9) and the dual direction is F = C \* (9/5) + 32.
>
> Temperature Converter increases the complexity of Counter by having bidirectional data flow between the Celsius and Fahrenheit inputs and the need to check the user input for validity. A good solution will make the bidirectional dependency very clear with minimal boilerplate code.
>
> Temperature Converter is inspired by the Celsius/Fahrenheit converter from the book Programming in Scala. It is such a widespread example—sometimes also in the form of a currency converter—that one could give a thousand references. The same is true for the Counter task.

## Modeling

Instead of thinking about this as bidirectional data flow, it can be simpler to think of this as a UI rendered from two values: `C` and `F`, and these two values can be updated due to events, such as `CELSIUS` for changing the C˚ input value and `FAHRENHEIT` for changing the F˚ input value. It just so happens that the `<input>` element both displays and updates the values, but that's just an implementation detail.

Note that when one of these events is sent to the machine, two things happen simultaneously:

- The desired temperature value is assigned to the _event value_
- The other temperature value is calculated and assigned based on that same _event value_

**States:**

- `"active"` - the state where converting the temperature is enabled

**Context:**

- `C` - the temperature in degrees Celsius
- `F` - the temperature in degrees Fahrenheit

**Events:**

- `"CELSIUS"` - signals that the Celsius value should change
- `"FAHRENHEIT"` - signals that the Fahrenheit value should change

## Coding

```js
import { createMachine, assign } from 'xstate';

export const temperatureMachine = createMachine({
  initial: 'active',
  context: { C: undefined, F: undefined },
  states: {
    active: {
      on: {
        CELSIUS: {
          actions: assign({
            C: (_, event) => event.value,
            F: (_, event) =>
              event.value.length ? +event.value * (9 / 5) + 32 : ''
          })
        },
        FAHRENHEIT: {
          actions: assign({
            C: (_, event) =>
              event.value.length ? (+event.value - 32) * (5 / 9) : '',
            F: (_, event) => event.value
          })
        }
      }
    }
  }
});
```

## Result

<iframe
  src="https://codesandbox.io/embed/7guis-counter-68083?fontsize=14&hidenavigation=1&theme=dark"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="7GUIs: Temperature"
  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
  sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
