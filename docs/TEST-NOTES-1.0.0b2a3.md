# TWP for Pale Moon 1.0.0b2a3 — TEST ONLY

## Improvements

- Experimental DeepL pacing relaxed from 1250 to 750 ms between dispatches in whole-page translation, selected-text translation, and preformatted-text processing. Concurrent DeepL requests remain capped at one. HTTP 429 handling/cooldown and Google/Bing protocols remain unchanged. This can increase rate-limit responses: use Google/Bing or wait if DeepL limits access.
- Added a **TWP for Pale Moon** submenu to the page context menu: **Translate page**, **Always translate example.com** (toggles the saved per-site rule), **Forget translation for example.com** (clears exact per-site rules and restores original text, but does not erase the translation cache), and **Restore original page**.
- Enabling automatic translation for a site activates the existing global site rule switch and immediately translates the active page when still in its original state; reloads use the existing auto-translation scheduler. No independent site-rule storage is introduced.
- Original selected-text context item is preserved. Context commands are hidden on non-HTTP(S) pages except selected-text translation.

## Validation

Run `python3 tools/run-uxp-tests.py` and `python3 tools/build-uxp.py`. DeepL pacing and context menu commands are covered by regression tests. Real browser tests are still required before any public release.

This build is experimental and not yet published. Basilisk is not officially supported.
