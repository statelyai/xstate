---
reviewed: 2021-10-01
styleGuideVersion: 0
---

# Visualizer

The [XState Visualizer](https://stately.ai/viz) is a tool for creating and inspecting statecharts to visualize the state of your applications.

As a visual tool, the Visualizer helps developers get an overview of their application logic, as well as making it easy to share and with designers, project managers and the rest of the team.

<p>
<iframe src="https://stately.ai/viz/embed/7c0ec648-09d6-46fe-a912-fc0e46da5094?mode=viz&panel=code&readOnly=1&showOriginalLink=1&controls=0&pan=0&zoom=0"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
<iframe src="https://stately.ai/viz/embed/7c0ec648-09d6-46fe-a912-fc0e46da5094?mode=panels&panel=code&readOnly=1&showOriginalLink=1"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
</p>

- _Write_ your application logic and immediately visualize it.
- _Save_ your statecharts to the Stately Registry and share them with anybody.
- _Share_ your statecharts in your team’s documentation with embedded mode and live-updating snapshot images.

---

The Visualizer already has many features to help you make your code do more.

## Write and visualize your code

Write and visualize your code _instantly_

<div style="position: relative; padding-bottom: 74.68879668049793%; height: 0;"><iframe src="https://www.loom.com/embed/f614f08d1a77478c8377aa2686cef06e" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>

1. Use the code editor in the **Code** tab to write your machine code.
2. Press **Visualize** to visualize your machine.

<!-- ## Visualize your machines in action

TODO: Visualize your machines in action in Inspect mode.

[Tango step-by-step example? Video?] -->

## Share your machines

There are multiple ways you can share your machines with your team and across the web.

<p>
<img alt="Share dropdown menu with options to Copy link, Twitter, Copy image URL and Embed." src="./share-menu.png" style="max-width: 655px"/>
</p>

The share menu contains four options:

1. **Copy link**. Copy the Visualizer URL for the machine.
2. **[Twitter](#twitter-link)**. Composes a tweet with a link to the machine.
3. **[Copy Image URL](#live-updating-snapshot-images)**. Copies a URL for a snapshot image of the machine.
4. **[Embed](#embed-mode)**. Creates an embeddable iframe containing the machine.

### Twitter link

The Twitter link option in the share menu composes a tweet with a link to the machine’s Visualizer URL.

<p>
<img alt="Composed tweet with the text “Check out the state machine I built in the @statelyai visualizer”, and a link to the machine." src="./tweet.png" style="max-width: 666px"/>
</p>

### Live-updating snapshot images

The Copy Image URL option in the share menu copies the URL for the image of the machine to your clipboard. The image is a snapshot of the machine, and will update with any changes to your machine.

The image below is a snapshot of [David’s example fetch machine](https://stately.ai/viz/7c0ec648-09d6-46fe-a912-fc0e46da5094).

![Statechart for a fetch machine.](https://stately.ai/registry/machines/7c0ec648-09d6-46fe-a912-fc0e46da5094.png)

### Embed mode

The Embed option in the share menu opens an options panel for an embeddable iframe of the machine.

Copy the code from the text area and paste it wherever you want to embed the machine. The machine can be embedded anywhere you can use iframes.

<div style="position: relative; padding-bottom: 74.68879668049793%; height: 0;"><iframe src="https://www.loom.com/embed/82da5f9ce99444a9849cbdbb55942468" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>

The embedded machine below is [David’s example fetch machine](https://stately.ai/viz/7c0ec648-09d6-46fe-a912-fc0e46da5094) in full mode with an active state panel, no link to the Visualizer, and control buttons enabled with panning and zooming both enabled:

<p>
<iframe src="https://stately.ai/viz/embed/7c0ec648-09d6-46fe-a912-fc0e46da5094?mode=full&panel=state&readOnly=1&showOriginalLink=0&controls=1&pan=1&zoom=1"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
</p>

You can choose from a number of options for your embedded machine:

#### Mode option

The default mode is **viz**.

- **viz**: Show only the Visualizer in the embedded iframe.
- **panels**: Show only the **Code**, **State**, **Events** and **Actors** panels in the embedded iframe.
- **full**: Show both the Visualizer and the **Code**, **State**, **Events** and **Actors** panels in the embedded iframe.

#### Show control buttons option

In **viz** and **full** modes, there are further options to show the control buttons for the Visualizer. When **show control buttons** is selected, there are additional options to **Allow panning** and **Allow zooming**. If these options are not selected, the buttons will be visible but disabled.

#### Panel options

In **panels** and **full** modes, there are further options to select the **active panel**, make the Editor readonly, and show the original link to the Visualizer.

## Fork existing machines

Found a useful machine in [the Registry](https://stately.ai/registry)?

You can fork the machine, using the **Fork** button, and make it work for your own uses.

<!-- ## Import existing machines

Import existing machines from GitHub gists -->

## Useful error messages

The Visualizer has descriptive error messages to help you understand and correct the issue when your code can’t be visualized.

<p>
  <img alt="Error message reading “',' expected.”." src="./syntax-error.png" style="max-width: 310px"/>
  <img alt="Error message reading “Invalid transition definition for state node 'fetch.failure': Child state 'load' does not exist on 'fetch'”." src="./transition-error.png" style="max-width: 570px"/>
  <img alt="Error message reading “Unable to evaluate guard 'notImplemented' in transition for event in state node '(machine)': ((intermediate value)(intermediate value)(intermediate value) || t.predicate is not a function”." src="./guard-error.png" style="max-width: 570px"/>
</p>

The error will fade away after 4 seconds. Press **Visualize** to view the error again.

## Custom code editor themes

In the Visualizer’s settings you can choose from thirteen color themes for the code editor, including the default **XState Viz** theme.

<ul class="gallery">
  <li><img alt="Visualizer code editor with XState Viz theme." src="./theme-xstate-viz.png"/><strong>XState Viz</strong></li>
  <li><img alt="Visualizer code editor with Night Owl theme." src="./theme-night-owl.png"/><strong>Night Owl</strong></li>
  <li><img alt="Visualizer code editor with All Hallows Eve theme." src="./theme-all-hallows-eve.png"/><strong>All Hallows Eve</strong></li>
  <li><img alt="Visualizer code editor with Amy theme." src="./theme-amy.png"/><strong>Amy</strong></li>
  <li><img alt="Visualizer code editor with Blackboard theme." src="./theme-blackboard.png"/><strong>Blackboard</strong></li>
  <li><img alt="Visualizer code editor with Cobalt theme." src="./theme-cobalt.png"/><strong>Cobalt</strong></li>
  <li><img alt="Visualizer code editor with Merbivore Soft theme." src="./theme-merbivore-soft.png"/><strong>Merbivore Soft</strong></li>
  <li><img alt="Visualizer code editor with Monokai theme." src="./theme-monokai.png"/><strong>Monokai</strong></li>
  <li><img alt="Visualizer code editor with Tomorrow Night theme." src="./theme-tomorrow-night.png"/><strong>Tomorrow Night</strong></li>
  <li><img alt="Visualizer code editor with Poimandres theme." src="./theme-poimandres.png"/><strong>Poimandres</strong></li>
  <li><img alt="Visualizer code editor with Garden of Atlantis theme." src="./theme-garden-of-atlantis.png"/><strong>Garden of Atlantis</strong></li>
  <li><img alt="Visualizer code editor with Martian Night theme." src="./theme-martian-night.png"/><strong>Martian Night</strong></li>
  <li><img alt="Visualizer code editor with Atom One Dark theme." src="./theme-atom-one-dark.png"/><strong>Atom One Dark</strong></li>
</ul>

### How to change the code editor’s color theme

1. Go to Settings using the button in the top menubar.
2. Scroll down to the **Editor Theme** section.
3. Choose your preferred theme from the dropdown menu.
4. Go back to the Code view using the **Code** button in the top menubar.

## View controls

<p>
  <img alt="View controls panel featuring icons for zoom out, zoom in, fit to view, reset canvas, hand tool, and a button with reset label." src="./view-controls.png" style="max-width: 255px"/>
</p>

The view controls panel helps you navigate around your statechart.

<div style="position: relative; padding-bottom: 74.79224376731301%; height: 0;"><iframe src="https://www.loom.com/embed/806824c22a97421694f0aa45a74b91e8" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>

<ul class="icon-list">
  <li><img alt="Zoom out icon." src="./zoom-out.png"/><strong>Zoom out</strong>. Zoom out of the canvas to view more of your statechart.</li>
  <li><img alt="Zoom in icon." src="./zoom-in.png"/><strong>Zoom in</strong>. Zoom into the canvas to view details in your statechart.</li>
  <li><img alt="Fit to view icon." src="./fit-to-view.png"/><strong>Fit to view</strong>. Fit your entire statechart into the available viewing space.</li>
  <li><img alt="Reset canvas icon." src="./reset-canvas.png"/><strong>Reset canvas</strong>. Reset the statechart’s position to the top left of the viewing space at 100% zoom level.</li>
  <li><img alt="Hand icon." src="./hand.png"/><strong>Hand tool</strong>. Select the hand tool to enter press and drag mode. Then press, hold and drag to move around the canvas. To exit press and drag mode, deselect the hand tool.</li>
  <li><img alt="Reset button text." src="./reset.png"/><strong>Reset button</strong>. Reset the statechart’s sequence to its initial state.</li>
</ul>

## Keyboard shortcuts and command palette

You can use keyboard shortcuts for common Visualizer commands. Find the list of **Keyboard shortcuts** in the Settings.

<p><img alt="The keyboard shortcuts in the Visualizer settings." src="./keyboard-shortcuts.png" style="max-width: 560px"/></p>

<div style="position: relative; padding-bottom: 74.79224376731301%; height: 0;"><iframe src="https://www.loom.com/embed/fedfec4a3ad5471d9f72a4c611ea9ee8" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>

- <kbd>CMD</kbd> + <kbd>S</kbd> Saves or updates the code in [Stately Registry](https://stately.ai/registry).
- <kbd>CMD</kbd> + <kbd>Enter</kbd> Visualizes the current editor code.
- <kbd>CMD</kbd> + <kbd>K</kbd> Show the Command palette.
- <kbd>Shift</kbd> + <kbd>?</kbd> Show the Command palette.

### Command palette

Use the <kbd>CMD</kbd> + <kbd>K</kbd> or <kbd>Shift</kbd> + <kbd>?</kbd> keyboard shortcut to show the **command palette**. The command palette gives you quick access to common Visualizer commands.

<p><img alt="The command palette showing commands for Saves or Updates the code in the Stately Registry and Visualizes the current editor code." src="./command-palette.png" style="max-width: 547px"/></p>

The command palette will have more commands in the future.

## And more…

- Sign in with GitHub
- Auto-saves locally so you won’t lose your work

## Upcoming features

We’ve got many more features coming soon. Including:

- Support for Lucy DSL (domain-specific language)
- Custom event and event payload support

## Get involved

[Take me to the Visualizer!](https://stately.ai)

[Try the Visualizer in Inspect mode](https://stately.ai/viz?inspect)

The Visualizer is available now and will be free and open source forever. Contributions are welcome!

### Feedback and bug reports

If you have any feedback or have any feature requests, please [join our Discord server](https://discord.gg/xstate) where you’ll find our team and the wonderful XState community.

Please [submit any bug reports as GitHub issues on the XState repository](https://github.com/statelyai/xstate/issues).
