# Covid Tracker

:::warning These XState v4 docs are no longer maintained

XState v5 is out now! [Read more about XState v5](https://stately.ai/blog/2023-12-01-xstate-v5) and [check out the XState v5 docs](https://stately.ai/docs/xstate).

:::

This example shows a current statistics about COVID-19 pandemic filtered by countries using XState and React. It contains:

- `covidMachine` - handles country selection, including a "sub-state" responsible for fetching the list of all countries across the globe
- `covidDataMachine` - handles fetching specific statistics (including `confirmed`, `deaths`, `recovered` cases) based on selected country

The two child components `<Indicator />` and `<Chart />` that responsibles of rendering data, consumes the service from the `MachineProvider` context provider

<iframe
  src="https://codesandbox.io/embed/covid-state-machine-lromu?fontsize=14&hidenavigation=1&theme=dark"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="covid-state-machine"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
