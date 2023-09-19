# Traqueur Covid

Cet exemple montre des statistiques actuelles sur la pandémie de COVID-19 filtrées par pays utilisant xState et React. Il contient:

- `covidMachine` - gère la sélection des pays, y compris un "sous-état" chargé de récupérer la liste de tous les pays du monde
- `covidDataMachine` - gère la récupération de statistiques spécifiques (y compris les cas : `confirmed`, `deaths`, `recovered`) en fonction du pays sélectionné

Les deux composants enfants `<Indicator />` et `<Chart />` qui sont responsables de la restitution des données, consomment le service provenant de `MachineProvider`.

<iframe
  src="https://codesandbox.io/embed/covid-state-machine-lromu?fontsize=14&hidenavigation=1&theme=dark"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="covid-state-machine"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
