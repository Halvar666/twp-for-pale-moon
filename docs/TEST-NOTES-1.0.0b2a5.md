# TWP for Pale Moon 1.0.0b2a5 — TEST ONLY

Base: `1.0.0b2a4`. This is a focused cleanup, not a new feature release.

## Changes

- Extract toolbar-placement initialization into `ensureToolbarButton()` without changing the previous logic.
- Add one `targetApplication` for Basilisk using its verified source identifier `{ec8030f7-c20a-464f-9b0e-13a3a9e97384}` and range `52.9.0–52.9.*`.
- Preserve Pale Moon target `{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}` 33.0–35.* and extension ID `twp-uxp-prototype@unofficial.local`.
- The Basilisk identifier is historically the Firefox application ID, so the declaration could also permit installation on older Firefox 52.9.x builds; these are not supported. This manifest change does not imply full functional compatibility with Basilisk.

## Manual acceptance

1. Pale Moon 35: install over b2a4. Confirm toolbar placement survives restart and Customize Toolbar, including removing and re-adding the button.
2. Basilisk 52.9.x in a separate profile: install without modifying the XPI, verify button visibility and translation (Google/Bing) on a regular page.
3. Move Basilisk's button to a different location and restart twice; verify no automatic repositioning. Also check removal from the toolbar.
4. Verify source/target language menus, page right-click submenu and selection translation.
5. Keep public 1.0.0b1 release unchanged until feedback is evaluated.

Automated tests simulate CustomizableUI; they are not a substitute for a real Basilisk test.
