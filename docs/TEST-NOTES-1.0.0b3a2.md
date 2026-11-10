# TWP for Pale Moon 1.0.0b3a2 — manual test notes

## Scope

- Localized UI via native XUL DTD and `.properties` resources (English, Czech).
- Languages are selected by the **browser UI locale** (`en-US`, `cs`, `cs-CZ`), not by the TWP translation target language. No language switch is added to Preferences in this alpha.
- Previous b3a1 backup/restore, JSON format, privacy defaults, provider requests and New Moon layout adjustment are unchanged.

## Suggested smoke tests

1. In Pale Moon with **Czech browser UI**, install b3a2 over b3a1, open Preferences. Check Czech captions, help text, keyboard shortcut tips, Backup and restore, and all scrollable sections; no visible `&options.###;` entities.
2. Open the toolbar popup and the right-click page/site menu. Check Czech text and behavior (including auto rules and Restore original). Long labels must not overlap the panel edges.
3. Translate a short selection, open its result dialog and check Czech status messages, Copy, Swap and Close.
4. Translate a page with Google or Bing; check localized progress messages, cancellation and restore while preserving the original formatting.
5. Export JSON, import the same JSON, and verify saved settings are not changed by the language of the UI. Confirm API keys remain optional and translation cache is not exported.
6. Change browser UI to English and restart; repeat the main popup and Preferences checks. The UI should be English without changing any translation preferences.
7. Basic Basilisk check: toolbar placement after restart, popup and Preferences. New Moon 28 is not tested and is not a declared compatibility target.

## Automated limitations

Automated tests exercise the bundled locale resources, HTML/XML entity expansion, mocked `nsIStringBundleService`, prior unit fixtures and XPI package integrity. The real browser must still verify XUL entity resolution and locale selection on its installed platform. Do not publish this build as final until that is checked.
