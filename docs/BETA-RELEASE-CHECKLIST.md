# TWP for Pale Moon 1.0.0b1 — release audit and validation gate

**Status:** beta candidate, not yet published. The maintainer reported on 2 November 2026 that version 1.0.0b1 is functional in Pale Moon. Version 0.0.1a33 remains the previously verified alpha reference. The individual extended acceptance scenarios below are retained as a checklist, not claimed as independently verified.

## Automated checks

1. Run `python3 tools/run-uxp-tests.py`; 0 failures and 0 timeouts required.
2. Run `python3 tools/build-uxp.py` and verify ZIP CRC, install.rdf version/ID, all XUL references and icons.
3. Keep the original upstream `src/` byte-identical to the a33 archive. Full source must include `uxp/`, tests, MPL 2.0 license and credits.
4. Confirm that executable XPI does not contain upstream WebExtension code or test fixtures.
5. Confirm privacy defaults: `privacyEnhancedRequests=true`, `persistentCacheEnabled=false`, `autoTranslateEnabled=false`, `showPageProgress=false`.

## Required final Pale Moon 35 acceptance tests (after installing this candidate)

- Upgrade **a33 → 1.0.0b1**: unchanged ID, preferences, shortcuts, toolbar placement, cache, translation provider selection and auto-rules.
- Google and Bing: translate an ordinary and a large page; Restore original; cancel midway and retry; selected-text translation.
- Same-origin iframe, HTML attributes, dynamic content and original-text hover when enabled.
- Both default theme and Noia Moon/other complete theme: normal/small button and Customize Toolbar.
- Open main popup and Preferences: progress notices must be **off by default**. Toggle on/off immediately; errors must always be displayed.
- Confirm About reports `1.0.0b1` and the manager shows only **native UXP port** wording.
- Test privacy on a safe public page; do not enter sensitive content. External providers still see sent text and IP, and third-party endpoints can fail.

## Pending before any public announcement

- Icon origin confirmed by the maintainer: AI-generated for this project, edited and finalized during development (see `CREDITS-UXP.md`).
- Choose and publish the **port's own** project/repository homepage. Until then the metadata has no homepage URL.
- Maintainer reports the **exact 1.0.0b1 XPI** is functional in Pale Moon. Additional detailed cross-theme/provider/cancellation scenarios remain recommended before a broadly promoted stable release.
- Do not present this port as an official upstream release; preserve `LICENSE`, `CREDITS.txt`, and full corresponding source.
