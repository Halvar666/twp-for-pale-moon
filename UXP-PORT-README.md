# TWP for Pale Moon

**Version:** 1.0.0b3 (third public beta)  
**Platform:** Pale Moon 33–35 declared (primary browser); Basilisk 52.9.* has **basic compatibility**. The maintainer has confirmed that Basilisk toolbar placement remains stable after restarts; full feature testing there is not claimed.  
**License:** MPL 2.0 (see `LICENSE` and `CREDITS-UXP.md`)  
**Origin:** Unofficial native port of [TWP – Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web) by FilipePS. This is **not an official release** of upstream TWP.

The port adds a native toolbar button, translation popup, language settings and page/selection translation to Pale Moon. The complete upstream WebExtension source snapshot is preserved in `src/` for reference; executable Pale Moon code lives separately in `uxp/`. This is a community-developed port, not endorsed by the original TWP developer.

## b3 features and compatibility notes

- Preferences → **Backup and restore**: export/import versioned JSON settings. Imports are validated before any preference is written; write errors trigger rollback. The SQLite translation cache and internal toolbar-position marker are never included. API key export is opt-in; importing an included key requires a separate confirmation.
- The translation-service chooser is enclosed in a horizontal XUL box to avoid vertical flex expansion with some older native themes. This is a best-effort layout adjustment, **not** New Moon 28 compatibility support.
- b3 includes native English and Czech UI strings. b3 adds German, French, Spanish, Polish, Slovak and Italian. The browser UI locale selects the language; translation target language and stored codes are unchanged. Language names still come from the TWP catalog. New translations should be checked by native speakers.
- Pale Moon 33–35 remains the primary target; Basilisk 52.9.x retains basic compatibility. The eight translations are initial drafts and may need proofreading.

## Features

- Native UI localization: English, Czech, German, French, Spanish, Polish, Slovak and Italian (non-English drafts may need native-speaker proofreading).
- Optional **three favorite target languages**, selectable in the toolbar translation popup without reopening Preferences; hidden when not configured, filtered by provider capability and included in JSON settings backups.

- Translate full pages or selected text using **Google Translate** or **Bing Translator**. Experimental **DeepL** is optional and may be rate-limited.
- Detect source language where possible; choose source and target languages in the popup.
- Translate dynamically inserted text, text-related HTML attributes and accessible **same-origin** frames; restore original text and cancel pending translation.
- Display the original text on hover when enabled.
- Optional site/language automatic-translation rules, including Never exclusions, with manual translation always available.
- Configurable keyboard shortcuts (including individual disable/reset); may conflict with system/browser bindings.
- Optional persistent SQLite translation cache in the Pale Moon profile. **Disabled by default**; user may clear cached translations.
- **Privacy-enhanced translation requests enabled by default** to suppress cookies/credentials and clear Referer when supported by the UXP channel. Fails closed if the required channel protection cannot be applied.
- Theme-independent toolbar button styling for regular/compact toolbars and the Customize Toolbar palette.
- Preserve line breaks, blank lines and indentation in selected-text translation and preformatted natural-language text.
- Conservative service backoff: Google/Bing honor HTTP 429 Retry-After, DeepL stops on HTTP 429 and retries one transient transport/server failure with a short delay. The page reports the remaining cooldown where available.
- Context submenu for page translation and per-site automatic translation rules. Experimental DeepL dispatch pacing reduced to 750 ms (still one concurrent request).
- **Custom dictionary:** Personal dictionary rules (`source => replacement`, or blank replacement to protect a term), preserving exact original/replacement text while translating surrounding fragments. Includes backup/export and eight UI language labels. Case-sensitive, per text node, all language directions. No dictionary terms are sent as translated fragments when matching.

## Limitations and privacy

- Providers use **unofficial/undocumented endpoints** and may change or block requests. DeepL can return HTTP 429, especially on long pages. This is not an official translation API client.
- The provider still receives the **translated text and public/VPN IP address**. Privacy-enhanced requests are **not anonymity**. See [`docs/PRIVACY-UXP.md`](docs/PRIVACY-UXP.md).
- Translation support does **not** include cross-origin iframe DOMs or every original WebExtension TWP feature. Google and Bing were tested on large pages, but provider availability cannot be guaranteed.
- Storing translations on disk can expose personal/sensitive page text to anyone with access to the local profile. Enable persistent cache only if acceptable; turning it off does **not** delete prior entries. Private windows do not use the persistent cache.
- **Beta software, not a stable release.** The 1.0.0b3 beta build is covered by 58 offline regression suites, including settings backups, multiline text, provider contracts, context-menu behavior, and toolbar placement. Real-world testing of all supported browser versions and translation providers is not complete.

## Install / update

In `1.0.0b2`, a second `targetApplication` allows installation in **Basilisk 52.9.x**. Its Australis-style toolbar placement is handled separately from classic Pale Moon toolbars, and the maintainer verified that the Basilisk button remains in place after restarting. This is **basic compatibility**, not a guarantee that all TWP features work in Basilisk. Basilisk uses Firefox's historical application ID `{ec8030f7-c20a-464f-9b0e-13a3a9e97384}`; the manifest entry could therefore also match old Firefox builds, **which are not supported**. Pale Moon remains the primary target.

Install the generated XPI from Pale Moon's Add-ons Manager. Updating from `0.0.1a33` preserves the existing add-on identifier `twp-uxp-prototype@unofficial.local` **intentionally**, so your preferences, toolbar placement, cache and custom shortcuts remain associated with the same extension. Do not rename this ID merely to remove the legacy word 'prototype'; changing it would create a separate add-on.

**Toolbar use:** normal click opens the translation popup; Ctrl+click or Shift+click starts translation directly; right click opens the context menu. The popup also provides Preferences.

## Build from the complete source archive

```bash
python3 tools/build-uxp.py
```

`tools/build-uxp.py` is the **only maintained XPI packager**. It verifies required XUL/XML files, PNG signatures, version metadata and the preserved upstream snapshot, then builds an XPI containing only `uxp/` runtime resources plus the license and current README. It does not package upstream WebExtension code or test fixtures.

Run the port checks (Node and Python required for the test tools, **not** for installing XPI):

```bash
python3 tools/run-uxp-tests.py
```

The default test command **discovers and runs every** `test-*.js` and `test-*.py` under `tools/` and `uxp/tests/` (not just a curated subset). Each fixture has an isolated process, a per-test timeout, and a strict exit-code check. Run `python3 tools/run-uxp-tests.py --list` to inspect the suite or `--filter bing` to narrow it. Legacy integration fixtures load the *real* persistent-cache module in a disabled, mock-pref environment. Privacy-network transport is tested separately with a simulated channel; no tests send internet traffic. Node tests cannot substitute for a real Pale Moon smoke test.

`src/`, `upstream/README-original-TWP.md`, `upstream/PRIVACY-original-TWP`, upstream build scripts and other upstream files preserve the original project for reference. The original upstream readme was moved to a separate path to avoid confusion with this port's root README on GitHub and on case-insensitive file systems. The archived upstream privacy statement describes its original browser extension, **not** the native UXP port. See [`docs/PRIVACY-UXP.md`](docs/PRIVACY-UXP.md) for this fork's behavior. The original chronology is archived in [`docs/DEVELOPMENT-HISTORY.md`](docs/DEVELOPMENT-HISTORY.md); subsequent changes go to [`CHANGELOG-UXP.md`](CHANGELOG-UXP.md).

## Runtime architecture after Cleanup 3

The browser-window integration is split into four scripts loaded in **strict order** by `uxp/chrome/content/browserOverlay.xul` (after the provider, cache and UI dependencies):

1. `pageController.js` — DOM collection, iframe/dynamic observers, translation batch scheduler, rollback and hover; a **per-window factory** owns no global page state.
2. `selectionController.js` — selected-text extraction, batching and native selection dialog.
3. `browserChrome.js` — toolbar/context menu, page state view, About, automatic rules and browser load/unload handlers.
4. `browser.js` — small bootstrap (preferences, one WeakMap per browser window, status messages and the stable `TWPUXP` public facade).

Factories receive **explicit context dependencies** and share the original per-window state. The public `TWPUXP` methods, add-on ID, preference keys and runtime behavior are deliberately unchanged. Do not alter the XUL script order or move the scheduler back into the bootstrap. The test `uxp/tests/test-a30-browser-modules.js` checks this contract. The original extracted function bodies were preserved during refactoring; integration tests exercise them as separate modules.

For the historical a32 scheduler lifecycle and error recovery acceptance criteria see [`docs/STABILIZATION-CHECKLIST.md`](docs/STABILIZATION-CHECKLIST.md).

## Manual smoke test for 1.0.0b3

1. Install 1.0.0b3 over b2 or b3a7 without resetting prefs. Check Google/Bing page and selection translation, Restore, popup, hover and cache as appropriate.
2. Toggle Privacy-enhanced translation requests; the original preference value must be preserved.
3. Test the icon in default and custom themes, both normal and small toolbars; drag it into Customize Toolbar and back. Other toolbar icons must retain their sizing and sprite regions.
4. Open right-click menu → **About TWP for Pale Moon**. Check that it displays the installed version (read dynamically) and no longer says Experimental/Prototype.
5. Confirm the keyboard shortcuts, per-site rules and selection context menu still respond. Check the About dialog shows `1.0.0b3`. **DeepL remains experimental**.
6. If a provider reports HTTP 429, verify that translation stops, shows a cooldown estimate and does not silently switch to another service. After repeated 502/503 errors, only a bounded number of requests should be sent; partial translation must remain restorable.


7. In Preferences, export a JSON backup (no API key), modify settings, then import the backup and verify restoration. Confirm the cache and toolbar position are unchanged.
8. Stress-test cancellation during an in-flight request: cancel halfway through, verify no late response rewrites the DOM, restore the original, then retry. Switch tabs during an active translation and verify only the intended tab is modified.

### On-page progress notices (introduced in 0.0.1a33)

Floating translation progress notifications are **off by default**. Open **Preferences → Page translation** and enable **Show on-page translation progress notices** to restore them for diagnostics. The main TWP popup always reports translation status, and error notifications are displayed regardless of the preference. The preference is saved in `extensions.twpuxp.showPageProgress` (default `false`).


## Beta provenance and support

This beta includes modified code based on **TWP – Translate Web Pages** by **FilipePS and contributors**, published under MPL 2.0. Its current upstream repository is <https://github.com/FilipePS/Traduzir-paginas-web>. It is **not an official FilipePS release**, and the upstream repository is not this port's support or issue tracker. The independent source repository is <https://github.com/Halvar666/twp-for-pale-moon>.

The maintainer has tested the preceding beta candidates in Pale Moon and checked toolbar placement in Basilisk. The b3 dictionary is conservative and case-sensitive: it matches within individual text nodes, and splitting a sentence around protected terms may change translation fluency. Users should review results before relying on them. The maintainer has confirmed the provenance of the custom port icons; see `CREDITS-UXP.md` and `uxp/artwork/`.

### Historical b2a1 test focus

- Selected-text translation: preserve internal line breaks, blank lines, CRLF and indentation, including selections exceeding 780 characters.
- README pages with `<pre>` change histories: retain every line while translating natural-language content. Code blocks remain subject to existing translation exclusions; the extension does not promise to translate source code.
- Manual Auto source selection: when Japanese/CJK text conflicts with an English UI language declaration, allow provider text-based detection instead. Explicit source choices and automatic-translation site/language rules remain unchanged.
- **Known limitation:** third-party translation services can still change punctuation or wording within each line.

### 1.0.0b2a2 Google fix (unpublished)

The b2a1 multiline-PRE path created synthetic translation pieces with `originals` but without `nodes`. Bing accepts these pieces, but Google requires the matching `nodes` array to decode its indexed HTML response. b2a2 restores the provider contract without changing the Google or Bing adapters or the original DOM node until the complete translation is assembled. The new integration regression calls the real Google adapter with mocked HTTP responses.
