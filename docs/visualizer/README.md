---
reviewed: 2021-10-01
styleGuideVersion: 0
---

# Visualizer

The [XState Visualizer](https://stately.ai/viz) is a tool for creating and inspecting statecharts to visualize the state of your applications.

As a visual tool, the Visualizer helps developers get an overview of their application logic, as well as making it easy to share and with designers, project managers and the rest of the team.

[Video introducing the viz basics]

- _Write_ your application logic and immediately visualize it.
- _Save_ your statecharts to the Stately Registry and share them with anybody.
- _Share_ your statecharts in your team’s documentation with embedded mode and live-updating snapshot images.

## Features

The Visualizer already has many features to help you make your code do more.

### Write and visualize your code _instantly_

[Tango step-by-step example? Video?]

### Visualize your machines in action in Inspect mode

[Tango step-by-step example? Video?]

### Share your machines in your documentation, blogs and anywhere on the web with embed mode

[Tango step-by-step example? Video?]

Embed mode can be used anywhere you can use iframes.

### Share your machines everywhere with live-updating snapshot images

[Tango step-by-step example? Video?]

### Import existing machines from GitHub gists

[screenshot/s with description?]

### Useful error messages

[screenshot with description?]

### Custom themes for the code editor

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

#### How to change the code editor’s color theme

1. Go to Settings using the button in the top menubar.
2. Scroll down to the **Editor Theme** section.
3. Choose your preferred theme from the dropdown menu.
4. Go back to the Code view using the **Code** button in the top menubar.

### Zoom and pan to get an overview of your statechart

<p>
  <img alt="View controls panel featuring icons for zoom out, zoom in, fit to view, reset canvas, hand tool, and a button with reset label." src="./view-controls.png" style="max-width: 255px"/>
</p>

The view controls panel helps you navigate around your statechart.

<div style="position: relative; padding-bottom: 74.79224376731301%; height: 0; margin: 1rem 0;"><iframe src="https://www.loom.com/embed/806824c22a97421694f0aa45a74b91e8" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>

<ul class="icon-list">
  <li><img alt="Zoom out icon." src="./zoom-out.png"/><strong>Zoom out</strong>. Zoom out of the canvas to view more of your statechart.</li>
  <li><img alt="Zoom in icon." src="./zoom-in.png"/><strong>Zoom in</strong>. Zoom into the canvas to view details in your statechart.</li>
  <li><img alt="Fit to view icon." src="./fit-to-view.png"/><strong>Fit to view</strong>. Fit your entire statechart into the available viewing space.</li>
  <li><img alt="Reset canvas icon." src="./reset-canvas.png"/><strong>Reset canvas</strong>. Reset the statechart’s position to the top left of the viewing space at 100% zoom level.</li>
  <li><img alt="Hand icon." src="./hand.png"/><strong>Hand tool</strong>. Select the hand tool to enter press and drag mode. Then press, hold and drag to move around the canvas. To exit press and drag mode, deselect the hand tool.</li>
  <li><img alt="Reset button text." src="./reset.png"/><strong>Reset button</strong>. Reset the statechart’s sequence to its initial state.</li>
</ul>

### Keyboard shortcuts and command palette

You can use keyboard shortcuts for common Visualizer commands. Find the list of **Keyboard shortcuts** in the Settings.

<img alt="The keyboard shortcuts in the Visualizer settings." src="./keyboard-shortcuts.png" style="max-width: 560px"/>

<div style="position: relative; padding-bottom: 74.79224376731301%; height: 0; margin: 1rem 0;"><iframe src="https://www.loom.com/embed/fedfec4a3ad5471d9f72a4c611ea9ee8" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>

- <kbd>CMD</kbd> + <kbd>S</kbd> Saves or updates the code in Stately Registry.
- <kbd>CMD</kbd> + <kbd>Enter</kbd> Visualizes the current editor code.
- <kbd>CMD</kbd> + <kbd>K</kbd> Show the Command palette.
- <kbd>Shift</kbd> + <kbd>?</kbd> Show the Command palette.

#### Command palette

Use the <kbd>CMD</kbd> + <kbd>K</kbd> or <kbd>Shift</kbd> + <kbd>?</kbd> keyboard shortcut to show the **command palette**. The command palette gives you quick access to common Visualizer commands.

<img alt="The command palette showing commands for Saves or Updates the code in the Stately Registry and Visualizes the current editor code." src="./command-palette.png" style="max-width: 547px"/>

The command palette will have more commands in the future.

### And more

- Login with GitHub
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
