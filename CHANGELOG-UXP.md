## 1.0.0b3 — Third public beta

[Added] Versioned JSON settings backup/restore with optional API key handling; local cache excluded.

[Added] Eight native XUL UI languages, up to three favorite target languages, and an optional case-sensitive custom dictionary.

[Improved] HTTP 429 / Retry-After protection and bounded transient-error retries without automatic provider switching.

[Fixed] Defensive XUL service dropdown layout, duplicated locale-script loading.

[Build] Final stabilization: reproducible clean XPI and 58 automated regression checks. No new functional changes after b3a6.

[Compatibility] Pale Moon 33–35 (primary); basic Basilisk 52.9.x support. New Moon and Firefox remain unsupported.

## 1.0.0b3a7 — Clean build and final stabilization (unreleased test build)

- [Stabilization] No new features or changes to translation provider logic, page/selection translation, settings, or UI behavior compared with 1.0.0b3a6.
- [Build] Reproducible XPI packaging with fixed ZIP entry timestamps and permissions; ignore temporary/editor-generated files during packaging.
- [Build] Preflight all eight registered locale catalogs and all three localized XUL windows, instead of checking only English and Czech.
- [Tests] Add repeat-build and runtime-manifest consistency checks. Keep all existing regression suites and both application targets unchanged.
- [Compatibility] Pale Moon 33–35 remains the primary target; Basilisk 52.9.x retains basic compatibility. New Moon and historical Firefox are not supported.
- [Privacy] No new network endpoints, permissions, services, cache behavior, or changes to backup data.

## 1.0.0b3a6 — Service resilience (unreleased test build)

- [Improved] Google: honor HTTP 429 `Retry-After` without retrying during the advertised cooldown. Without this header, keep the pre-existing maximum of two short 429 retries; a final 429 starts a one-minute cooldown.
- [Improved] Bing: recognize HTTP 429, honor `Retry-After` with a one-minute minimum, and classify transient HTTP/network errors for the existing page-level failure handling. No automatic Bing retries.
- [Improved] DeepL (experimental): do not automatically repeat HTTP 429; preserve the existing cooldown and allow at most one delayed retry (1.25s) for transient 408/5xx/network/timeouts. Invalid payload, HTTP 4xx and privacy-protection errors are never retried.
- [Improved] Page status: show a localized approximate cooldown after an HTTP 429; stop further batches while keeping already translated text restorable and never switching providers without permission.
- [Localization] Added `page.serviceLimit` and `page.retryAfter` messages in all eight UI locales; no new permissions or preferences.
- [Tests] Offline mocked-transport regression tests for 429, Retry-After, transient retries, callback uniqueness, and safe page stopping. Manual checks against live services remain necessary.
- [Unchanged] Service endpoints, text mapping, persistent cache, settings backup, custom dictionary, add-on ID and declared Pale Moon/Basilisk compatibility.

## 1.0.0b3a5 — Custom dictionary (unreleased test build)

- [Added] Optional, case-sensitive personal translation dictionary: `source => replacement`; an empty replacement keeps the exact original term. Up to 100 entries, with duplicate/length validation.
- [Added] Dictionary for full-page (grouped and classic) and selected-text translation, with special handling for multiline/preformatted content. Terms match inside individual text nodes; HTML structure and restored originals remain unchanged.
- [Added] Include dictionary text in the existing v1 JSON settings backup; Unicode-safe ASCII preference storage supports accents on older UXP engines. Existing backups remain importable.
- [Improved] Keep protected/replaced terms outside translation requests. Batch the remaining fragments conservatively and retain 750ms pacing for experimental DeepL.
- [Localization] Added dictionary captions/help text to all eight UI languages; translation engines and application compatibility unchanged.
- [Tests] 55/55 offline suites: validation, Unicode, fragment batching, protected-term omission, settings round-trip, provider integration with mocked Google HTTP 502 and original-page restoration.
- [Limitations] Matching is exact and case-sensitive, and does not span HTML text-node boundaries. Breaking sentences around custom terms can affect grammatical flow. Real-browser/network testing is still required.

## 1.0.0b3a4 — Favorite target languages (unreleased test build)

- [Added] Up to three optional, distinct favorite target languages in Preferences, independent of the selected translation provider.
- [Added] Contextual shortcut buttons in the main popup; select a favorite to set the target language for the next translation. The buttons remain hidden when no favorites are configured.
- [Added] Provider-aware filtering: unsupported favorites are hidden in the popup, but the stored favorites are preserved when the service changes.
- [Added] Export/import of favorite targets in the existing JSON settings-backup format (v1), including strict validation and backward-compatible import of older backups.
- [Fixed] Load `l10n.js` only once per XUL window instead of four times.
- [Tests] 52/52 automated suites, including favorites/popup behavior, provider filtering, backup round-trip and 8 complete locale catalogs.
- [Unchanged] Google, Bing and experimental DeepL provider implementations; Pale Moon/Basilisk declarations, previous settings and extension ID.

## 1.0.0b3a3 — Additional UI languages (unreleased test build)

- [Added] Native DTD and `.properties` UI translations for German, French, Spanish, Polish, Slovak and Italian.
- [Added] Language registration with both short and regional locale codes; existing en-US and Czech locale support retained.
- [Tests] Added checks for 8 complete language catalogs (104 static and 105 dynamic keys each), XUL entity expansion, JSON/settings safety prompts, replacement placeholders and resource packaging.
- [Unchanged] Translators, backup/restore JSON schema, addon identity, settings and Basilisk compatibility. No New Moon support is claimed.
- [Note] Additional translations are initial drafts; native-speaker proofreading and browser layout checks remain welcome.

## 1.0.0b3a2 — English/Czech UI localization (unreleased test build)

- [Added] Native chrome locale resources (`en-US`, `cs`, `cs-CZ`) with XUL DTD entities and `.properties` string bundles.
- [Added] Localized Preferences, backup/restore prompts, toolbar popup, site/context menus, selection dialog, and page-translation status messages.
- [Safety] Language codes, provider identifiers, stored preferences, settings JSON format, add-on ID, and translation engines are unchanged. English fallbacks remain available for absent dynamic keys.
- [Tests] Added native locale tests for matching DTD/properties keys, both localized XUL layouts, and run-time string-bundle substitutions; offline XUL validation now resolves bundled entities without remote DTDs.
- [Compatibility] Pale Moon remains primary; basic Basilisk support unchanged. New Moon 28 remains unsupported.

## 1.0.0b3a1 — Development test build (unreleased)

- [Added] Versioned JSON export/import of saved preferences, automatic rules, and shortcuts.
- [Added] Optional API key export (explicit opt-in) and separate confirmation on import.
- [Fixed] XUL layout: keep the translation-service dropdown in a horizontal container to avoid unintended vertical stretching in older themes (best-effort).
- [Safety] Reject unknown or malformed backup entries before applying; roll back changes if a preference write fails; exclude SQLite translation cache and toolbar placement.
- [Compatibility] No change to declared Pale Moon/Basilisk targets; New Moon remains unsupported.

# TWP for Pale Moon — UXP port changelog

## 1.0.0b2 — Second public beta candidate

[Fixed] Preserve line breaks, blank lines and indentation when translating selected text and eligible multiline preformatted natural-language content, including GitHub README update histories. Restore Google's provider-fragment contract for the new multiline path.

[Improved] When manually translating with Auto source, allow service-side detection where strongly Japanese/Korean/Chinese text conflicts with the document language. Existing explicit language choices and automatic-translation rules remain unchanged.

[Changed] Reduce experimental DeepL dispatch spacing from 1250 ms to 750 ms. Requests remain serialized and DeepL can still respond with HTTP 429.

[Added] A page context submenu to translate, set/remove automatic translation for the current site, and restore the original. Existing selected-text context menu remains available.

[Compatibility] Keep the guarded Australis/CustomizableUI toolbar placement logic and Basilisk 52.9.x target in `install.rdf`; Basilisk toolbar placement has been manually confirmed stable. This is basic Basilisk compatibility, not full feature support; Pale Moon remains the primary browser. Firefox is not supported.

[Cleanup] Finalize b2 version, regression metadata, and beta documentation with no translation-engine logic changes after b2a5.

[Tests] 45/45 regression suites passing; packaging, application IDs, version metadata and XPI contents additionally verified. The b2 package still requires final browser installation verification before public release.

## 1.0.0b2a5 — Cleanup and Basilisk test target (unpublished)

[Cleanup] Extracted toolbar-placement initialization from the browser-load handler into `ensureToolbarButton()`. The classic Pale Moon and guarded Australis/CustomizableUI logic is unchanged.

[Compatibility] Added Basilisk's current application ID `{ec8030f7-c20a-464f-9b0e-13a3a9e97384}` to `install.rdf` with version range `52.9.0–52.9.*` for manual testing. This historical ID is also used by Firefox; no Firefox support is claimed. Pale Moon's existing target range remains unchanged.

[Unchanged] Translation engines, context menu, selection formatting, settings, toolbar button ID, add-on ID, cached translations and automated rules.

[Tests] Added a manifest regression checking exact target IDs/ranges, version consistency and preservation of the extension ID.

## 1.0.0b2a4 — Test build (guarded Australis toolbar placement)

[Fixed] On Australis-style toolbars with a `customizationtarget` attribute, consult CustomizableUI placement before inserting the TWP widget. Preserve placement in any area without moving it. If unplaced on first installation, use CustomizableUI to add it to the navigation area. Never force classic `insertItem`/`currentset` persistence on an Australis toolbar.

[Compatibility] This is a one-off defensive fix for Basilisk's inherited Firefox 29–56 toolbar architecture, **not** an official Basilisk support claim. Pale Moon's original classic toolbar logic and declared application ID range remain unchanged.

[Tests] Added isolated runtime regression tests for existing Australis placement, initial placement, previously removed widget, failing CustomizableUI import, and unchanged classic Pale Moon behavior.

[Unchanged] Google/Bing/DeepL backends, DeepL pacing, page/selection translation, context actions, settings, addon ID and privacy defaults.

## 1.0.0b2a3 — Test build (DeepL pacing and page context menu)

[Changed] Reduced experimental DeepL pacing from 1250ms to 750ms; still one request at a time, HTTP 429 stops immediately. Google/Bing unaffected.

[Added] Native page context submenu with Translate page, Always translate current hostname, Forget translation for current hostname (clears site overrides and restores original), and Restore original.

[Tests] Added context menu and DeepL pacing regression coverage. Remains an unpublished test build.

## 1.0.0b2a2 — Google multiline PRE fix (unpublished test build)

[Fixed] Restore Google's expected provider contract for synthetic text fragments produced by the multiline <pre> translation path. Each fragment now supplies a matching nodes[] entry; Google previously stopped with "missing[i].nodes is undefined". Bing's adapter and translation protocols are unchanged.

[Tests] Added a regression exercising the actual Google adapter, its mocked HTTP response, segmentation/reassembly of a Japanese GitHub-style update history and Restore original. Demonstrated that the test fails in 1.0.0b2a1 before the fix and passes after it.

[Unchanged] b2a1 whitespace/paragraph preservation, language detection, privacy settings, toolbar behavior, cache defaults and add-on ID.

## 1.0.0b2a1 — Unpublished test build

[Fixed] Preserve line breaks, blank lines, indentation and text boundaries when translating selected text or multiline preformatted README content.

[Improved] When a user manually chooses Auto, a strong Japanese/Korean/Chinese script mismatch with the page's declared language requests detection from the translation provider instead of forcing the UI language.

[Tests] Add regressions for CRLF, multi-paragraph selections, Japanese README histories and restoration.

[Unchanged] Provider endpoints and explicit language choices, automatic site/language rules, add-on ID and preferences, toolbar behavior and privacy defaults.

## 1.0.0b1 — First beta candidate (release audit)

[Changed] Updated version to `1.0.0b1`, without changing the existing add-on ID, settings or translation logic.

[Fixed] Corrected installed README version/update instructions and obsolete alpha-only packaging test; added beta-specific manual acceptance checklist.

[Docs] Added dedicated source attribution, clarified the unofficial status and limits, documented current privacy behavior and provider reliability.

[Changed] Removed the misleading `homepageURL` pointing to the original, unrelated-to-this-port issue tracker. Upstream credit remains in About and documentation.

[Unchanged] Google/Bing/DeepL provider code, page scheduler, popup, translation progress notices (off by default), privacy requests, SQLite cache, icons, shortcuts and all preferences.

[Validation] Automated tests and package integrity passed; on 2 November 2026, the maintainer reported that the installed 1.0.0b1 works in Pale Moon. This does not independently establish full regression coverage on every supported browser version.

[Artwork] The maintainer confirmed that the port-specific blue emblem originated in ChatGPT image generation and was subsequently adjusted and finalized for this project.

## 0.0.1a33 — Beta preparation: optional progress notices


- Add **Show on-page translation progress notices** in Preferences → Page translation (default: off).
- Keep progress messages visible in the main TWP popup even when floating notices are disabled.
- Always display provider and translation errors; do not let the progress setting silence failures.
- Turning the option off removes an active non-error floating notice immediately in the current tab.
- No changes to translation providers, network privacy, cache, icons, or keyboard shortcuts.



## 0.0.1a32 — Stabilization 2 (scheduler lifecycle and error recovery)

[Fixed] Prevent a translation batch from being completed twice if a provider mistakenly invokes its callback repeatedly. One batch now has exactly one terminal result and cannot corrupt the in-flight queue count or commit the same translated DOM segment twice.

[Fixed] Catch synchronous exceptions while initializing a provider/cache request; report a stopped translation instead of leaving the page stuck in the running state. A subsequent manual retry remains possible.

[Tests] Added simulated network failures and duplicate callback regression, cancellation with late replies, restoration of partial translations, cross-tab isolation and successful retry. Packaging validation now compares README version with current install metadata rather than a pinned old alpha number.

[Unchanged] Google/Bing/DeepL request formats and privacy transport, persistent cache, icon/CSS, popup, shortcuts and all other user-facing preferences. No new functionality or endpoint changes.

## 0.0.1a31 — Stabilization 1 (UXP description / package audit)

[Changed] Add-ons Manager description now says **native UXP port**, with no mention of XUL in the user-facing summary. About and Preferences use the same UXP-only wording. The description is shorter to reduce truncation in the add-ons list.

[Tests] Added a packaging smoke test covering the actual XPI file, its installed metadata, chrome manifest targets, overlay script/CSS/image references, expected resources, and absence of test/artwork/upstream sources from runtime package. Release QA is repeatable with the single strict test runner.

[Docs] Added a stabilization checklist with manual acceptance criteria. No new translation features.

[Unchanged] Add-on ID and all preference names/defaults; Google, Bing and DeepL adapters; page/selection scheduling; privacy-enhanced request handling; SQLite cache; shortcut bindings; toolbar theme-specific rendering protections and existing icons.

## 0.0.1a30 — Cleanup 3

[Refactor] Split the former 846-line `browser.js` into `pageController.js` (page translation and dynamic content), `selectionController.js` (text selections), `browserChrome.js` (Pale Moon UI/lifecycle), and a 69-line bootstrap (`browser.js`).

[Compatibility] Preserve `TWPUXP` public API, extension identifier, preferences, translation provider code, privacy transport, cache, keyboard mappings and toolbar icons. Preserve original function implementations and dependency order in the XUL overlay.

[Tests] Adapted legacy runtime fixtures to load the separate modules and added a30 module-contract regression. Strict regression result: 34/34.

[Docs] Documented module responsibilities and bootstrap order. No new user-facing feature.

## 0.0.1a29 — Cleanup 2

[Fixed] Updated historical browser mocks to include the real cache module and repaired legacy fixtures that left timers running.

[Tests] All 33 existing test suites passed using the single strict `tools/run-uxp-tests.py` runner. Production JavaScript was unchanged from a28 (except version/package README).


## 0.0.1a28 — Cleanup 1

[Changed] Display name is **TWP for Pale Moon** without the misleading global *Experimental* tag. Google and Bing UI names are cleaned up; the optional DeepL provider remains explicitly experimental.

[Fixed] About item no longer shows an outdated hard-coded a22 version; it looks up the installed extension version using `AddonManager.jsm` (with a graceful fallback if that service is unavailable).

[Changed] The tested, strictly add-on-scoped toolbar icon rules were moved from `overlay.css` to `toolbarButton.css`. The stylesheet remains registered for **browser.xul and customizeToolbar.xul**, allowing theme-independent icon handling without global CSS selectors or fixed icon geometry.

[Removed] Obsolete duplicate packager `tools/build_xpi.py`; `tools/build-uxp.py` is the sole maintained XPI builder.

[Docs] Split current user/developer guide, historic alpha notes and port-specific privacy policy. Original upstream source and its own privacy file remain untouched.

[Unchanged] Extension ID, preferences, Google/Bing/DeepL protocols, XHR privacy layer, translation scheduler, original text on hover, cache, auto rules, keyboard shortcuts and icon PNG files.

## 0.0.1a27 — Privacy terminology and Customize Toolbar support

[Changed] Privacy setting renamed **Privacy-enhanced translation requests** to avoid suggesting full anonymity.

[Fixed] Register toolbar icon stylesheet for Customize Toolbar window and explicitly reset theme sprite regions.

## 0.0.1a26 — Privacy-enhanced requests

[Added] Shared HTTPS transport with XPCOM anonymous channel flags and a fail-closed privacy setting; applies to Google, Bing and DeepL.

## 0.0.1a23–a25 — Shortcuts and automatic language rules

[Added] Configurable XUL keyboard shortcuts, excluded page-language rules, and a 400px edge-aware translation popup.

## 0.0.1a17–a22 — Native popup and translation enhancements

[Added] Upstream-style popup, simple translation icon, persistent cache, original-text hover, and keyboard shortcuts. See `docs/DEVELOPMENT-HISTORY.md` for full version-by-version detail.
