# TWP for Pale Moon 1.0.0b3a7 — final stabilization (unreleased test build)

## Purpose

Clean, reproducible packaging of the tested b3a6 implementation, with no new end-user functionality. The eight language packs, backup/restore, favorites, custom dictionary and provider backoff behavior remain unchanged.

## Automated verification

- Run all `tools/test-*.js` and `tools/test-*.py` suites, then all `uxp/tests/test-*.js` suites, with `python3 tools/run-uxp-tests.py`.
- Build XPI twice from the same source tree and compare bytes and SHA256.
- Verify archive integrity, licensing, source attribution, fixed metadata, allowed files, all eight locale registrations, 24 localized XUL parses, and installed add-on/application IDs.
- Compare b3a7 runtime XPI with b3a6: only version and packaged README text should differ, apart from ZIP container metadata.

## Required manual smoke tests

1. Upgrade 1.0.0b3a6 to 1.0.0b3a7 in Pale Moon 35 without deleting settings. Verify saved site rules, preferences, favorites, custom dictionary and shortcut bindings.
2. Test page translation and selected text with Google and Bing, including multiline selections and Restore original. Test DeepL if its unofficial endpoint is available.
3. Export/import JSON settings, including Unicode dictionary entries. API key must remain excluded unless explicitly selected.
4. Open Preferences, main popup and selected-text window in a Czech locale; check the longer German/French translations if convenient. Confirm toolbar icon placement after restart.
5. Optionally smoke-test Basilisk 52.9.x and toolbar persistence. No New Moon/old Firefox testing or support promise.

Tests use offline mocked network responses; installation/rendering in the actual UXP browsers and live provider availability must still be manually confirmed. The published b2 release and GitHub source repository are unchanged pending maintainer approval.
