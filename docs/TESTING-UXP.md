# Testing the UXP port

Run `python3 tools/run-uxp-tests.py` for maintained smoke/integration suites. The strict runner discovers maintained Node/Python tests and fails on nonzero exit codes or timeouts. Tests simulate browser/provider behavior; they do not constitute a live Pale Moon session. Run individual tests directly with `node tools/test-*.js` or `node uxp/tests/test-*.js` where appropriate.

Manual testing in actual Pale Moon remains essential. Current high-priority cases:

- Translate and restore via Google/Bing; selection dialog; cached vs uncached text.
- Toolbar button regular/small and Customize window, both default and complete themes.
- Keyboard shortcut remapping, collision detection and disabling.
- Auto translate per-site and per-language exceptions.
- Privacy settings and failure messages; no guaranteed anonymity.
- About dialog shows actual installed add-on version, not a hardcoded value.

Upstream WebExtension files in `src/` must remain unchanged. In the XPI, the `uxp/tests/` and `uxp/artwork/` directories are omitted, as is upstream `src/`.

For 1.0.0b1 follow [`BETA-RELEASE-CHECKLIST.md`](BETA-RELEASE-CHECKLIST.md), including in-browser tests and asset provenance before publication.
