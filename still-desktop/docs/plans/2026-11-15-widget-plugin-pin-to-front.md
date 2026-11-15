# Widget plugin: Pin to Front

## Goal

Let users keep an important widget visible above overlapping cards in the current workspace. This is a per-widget add-on; it does not pin a window above other Windows applications.

## User flow

1. Open a widget's `+` add-on menu and add **Pin to Front**. The widget is pinned immediately.
2. Use the pushpin button in its header to pause or restore pinning while keeping the add-on installed.
3. Remove the add-on from the `+` menu to remove its control and clear the pinned state.

## Behavior

- Pinned cards stack above unpinned cards. Pinned cards retain a deterministic workspace order; the active pinned card sits above the other pinned cards.
- The pin state is part of saved workspace/widget state and survives collection into and restoration from a Group.
- Pinned cards remain movable, resizable, minimizable, and closable; Pin to Front does not behave like Lock.
- Pin state is local to each workspace widget and is not copied into a generic saved tray preset.

## Acceptance checks

- Add-on menu installs and removes the plugin with correct checkbox state.
- Header button toggles pinning and announces the current action with an accessible label and pressed state.
- A pinned card's z-index remains above overlapping unpinned cards; unpinning restores normal stacking.
- Pin and plugin-enabled state survive workspace serialization and Group collect/restore.
- Older workspace data defaults safely to unpinned.
- English and Chinese labels are present; type-check and focused plugin/workspace tests pass.

## Next plugin ideas

- **Progress badge:** set a widget to To do, In progress, or Done and filter the canvas by status.
- **Quick capture:** send selected text or a short typed thought to a chosen Notes page.
- **Focus dimmer:** spotlight one widget and dim the others until dismissed.
- **Reminder:** attach a date/time alert to a widget, using the existing timer/notification behavior where appropriate.
