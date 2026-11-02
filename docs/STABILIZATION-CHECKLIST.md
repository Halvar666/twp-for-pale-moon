# Stabilization checklist — TWP for Pale Moon 0.0.1a32

This is a **development alpha**, not a public stable/beta certification. Its main purpose is to freeze the feature set and prove an update from the last user-tested a31 build does not introduce regressions.

## Automated checks

Run from the complete source archive root:

```sh
python3 tools/run-uxp-tests.py
python3 tools/build-uxp.py
```

Additional stabilization: duplicate completion callbacks must be ignored, synchronous provider bootstrap errors must stop the page cleanly, and cancellation must invalidate pending responses. The release gate is **zero failed tests, zero timeouts**, plus passing the new `test-a31-package.py` packaging smoke test. The smoke test builds an XPI in a temporary directory and reads it back to check the expected files and `chrome://` references. It checks that the upstream WebExtension source and test harness are excluded from the installable package. The package version and description must match the source metadata, with **UXP** as the only user-facing platform acronym.

The automated suite runs simulated browser and provider environments, not a real Pale Moon UI or live translation endpoints. Passing is necessary but **not sufficient** for a public release.

## Required Pale Moon smoke tests

1. Install a32 over a31, preserving extension ID `twp-uxp-prototype@unofficial.local`, existing preferences, keyboard customizations and toolbar placement.
2. Verify Add-ons Manager displays **TWP for Pale Moon 0.0.1a32**, with description **native UXP port** and no **XUL/UXP** wording. In Preferences check **Native UXP translation preferences**; in About check accurate version.
3. Google and Bing: translate ordinary/large pages, translate selected text and restore original text. Verify untranslated content remains intact following errors and cancel.
4. Test dynamic content, same-origin iframes, translated attributes, original text hover, and automatic rules if practical. Do not enable persistent cache for sensitive pages.
5. Verify saved custom keyboard shortcuts, popup checkbox layout and both sides of Customize Toolbar, including a non-default complete theme and small toolbar icons.
6. Confirm Privacy-enhanced translation requests stays enabled and no privacy settings are reset. These requests **do not** conceal IP address or submitted translation text.

If all pass, mark a32 user-verified. Retain a31 as the known-good rollback until then. Version numbering remains alpha until a separate beta decision.
