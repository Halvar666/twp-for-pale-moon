# TWP for Pale Moon 1.0.0b2a4 — TEST ONLY

This build is based directly on b2a3. It keeps the DeepL pacing and page context menu changes.

## Single compatibility change

- Guarded Australis-style toolbar branch when `nav-bar` declares a separate `customizationtarget`.
- Read existing placement using `CustomizableUI.getPlacementOfWidget()`, respecting its area and position without moving the button.
- On first installation with no existing placement, register in the navigation bar using `CustomizableUI.addWidgetToArea()` and record completion.
- Do **not** call the classic `toolbar.insertItem()`/`document.persist()` path on Australis toolbars.
- On classic Pale Moon toolbars, the original insertion, persistence and placement checks remain unchanged.
- Basilisk ID is **not** added to `install.rdf`, and Basilisk remains **unsupported**. The user who tested Basilisk must add its application ID separately.

## Manual acceptance

1. On Pale Moon 35, install over b2a3, restart and verify the toolbar button stays at the chosen location. Test Customize Toolbar and moving the button to/from the palette.
2. Optional / unsupported Basilisk test in a separate profile: after manually adding Basilisk's ID, place the TWP button at a custom position and restart twice. The position should be retained, including when moved to another toolbar/panel.
3. Check translation providers and page context menu are unchanged.

Automated CustomizableUI tests use a simulated toolbar environment, not a running Basilisk binary. Do not promote compatibility based on these tests alone.
