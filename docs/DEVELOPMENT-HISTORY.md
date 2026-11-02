> Historical development log up to 0.0.1a27; newer behavior is documented in UXP-PORT-README.md.

# TWP for Pale Moon (Unofficial) — UXP port 0.0.1a27

**Upstream project:** https://github.com/FilipePS/Traduzir-paginas-web  
**Baseline:** original TWP release `v10.2.1.0`, source snapshot `50a92116542ab93524594cc210f4bf4e5d86a925`  
**Original TWP:** FilipePS and contributors  
**License:** MPL-2.0, original `LICENSE` retained.  
**Port:** Unofficial; not endorsed by FilipePS or the Pale Moon project.

This archive contains **the original upstream TWP source tree** (`src/`, build scripts and locale files) **plus a new `uxp/` build target**. The original WebExtension source tree remains unchanged. Unlike a Git clone, the uploaded ZIP snapshot does **not** contain `.git` history. Use `tools/prepare-full-fork.sh` to create a proper full-history Git branch if desired.

## What's implemented in UXP

- XUL browser overlay / toolbar integration (same element ID as working 0.0.1a1, avoiding toolbar customization regressions).
- New approved blue translation badge icon at 16, 24, 32, 48, 64, 128px, with browser and Customize Toolbar dialog CSS rules avoiding themed sprite region inheritance. Also used as extension manager icon.
- Translations through the *experimental, unofficial* Google, Bing and DeepL HTTP protocols adapted from upstream TWP's `translationService.js`; Google remains the default.
- New `pageTranslator.js`, an **adaptation of TWP's `getPiecesToTranslate` concept**: groups inline text from one paragraph into context-preserving segments, avoids forbidden/interactive elements and honors `translate=no`, `notranslate` and editable text.
- Indexed HTML markers (`<a i=n>`) and response mapping, adapted from original TWP Google provider logic.
- Provider-specific in-memory cache, plus optional persistent SQLite translation cache (disabled by default).
- Previous 0.0.1a1 one-node translation preserved as selectable fallback.
- Restore original page, progress status, cancel pending batches.

**This is NOT yet a complete, literal runtime port** of upstream `pageTranslator.js` or `translationService.js`. The main document, dynamic content, selected text, HTML attributes and accessible same-origin frames are handled, but cross-origin frame translation, several original TWP features and additional providers (e.g. Yandex) are not yet ported. A new native XUL popup provides upstream-style controls, including automatic site and page-language rules. The original TWP WebExtension sources are preserved for reference. Google, Bing and DeepL use unofficial service endpoints and may need updates if their response formats change.

## Changes from 0.0.1a1

- Icons integrated, explicit list-style-image and no inherited toolbar sprite.
- Added paragraph-based collector and indexed Google response mapper.
- Added runtime toggle between **TWP grouped** and **classic single-node** engine, and Cancel.
- Full upstream source available in the source ZIP.

## Test plan in Pale Moon 35

1. Install `0.0.1a27` over tested `0.0.1a26` (same extension ID); restart Pale Moon.
2. Confirm manual translation, selected-text popup and Noia Moon toolbar icon are unchanged.
3. In Preferences, confirm Google, Bing and DeepL language lists update on service change.
4. Enable automatic translation; enter a site such as `example.com`. Reload that page and check automatic translation.
5. Add the same hostname to the excluded-sites box; reload and confirm automatic translation is suppressed, while manual translation still works.
6. Enter a source page language such as `en` in the languages field and check an English-language page with `html lang` metadata. Confirm that an already-Czech page is skipped.

**Privacy and stability:** The translation content goes directly to the currently chosen provider (Google, Microsoft or DeepL); a26 added privacy-enhanced network requests, enabled by default; the provider still receives the text and IP address. Neither endpoint is a documented public translation API for third-party extensions; their format, availability, and terms can change. Google may use a retrieved web translation key; the user can configure an override. By default the port stores translations only in memory. The optional persistent cache stores original text (in lookup keys) and translated text in the Pale Moon profile. It is opt-in, disabled for private windows and can be cleared in Preferences. Disabling the option does not delete existing cached data. Do not distribute these prototypes as stable software without further evaluation.

## Developer build

```bash
python3 tools/build-uxp.py
node --check uxp/chrome/content/pageTranslator.js
node --check uxp/chrome/content/googleProvider.js
node --check uxp/chrome/content/browser.js
node tools/test-uxp-port.js
```

Port preferences in `about:config` begin with `extensions.twpuxp.`. Set `extensions.twpuxp.useTwpParagraphEngine=false` to force the previous working single-node mode.


## 0.0.1a4
- Narrowed toolbar icon CSS so themes such as Noia Moon keep their native toolbar icon proportions.
- TWP button icon is still explicit, but icon box sizing is now left to the active theme.

## 0.0.1a4: whole-page and speed improvements
- Default `extensions.twpuxp.maxNodes=0` means **no node limit** (old default was 120; old 600 upper clamp removed). Users can still specify a positive cap in about:config.
- One-time migration clears a stored old value of exactly 120; other user limits are preserved.
- Removed the 300ms pause between batches (delay=0 by default).
- Parallel batches share one in-flight token lookup instead of launching redundant authorization requests.
- New preference `extensions.twpuxp.concurrentRequests=3`, constrained to 1..6. Requests are processed in a bounded parallel queue, with 800-char batching maintained.
- New default `batchSize=8` (constrained to 1..20); higher means more pieces per request, not a larger overall character cap.
- Visible paragraphs are prioritized, while offscreen text remains in the queue. The progress now shows both nodes and groups.
- `requestDelayMs` still available as an explicit safeguard for throttled providers.
- Previous Noia Moon toolbar CSS fix is preserved unchanged.
- Full upstream source remains unchanged; UXP code is still experimental and Google is an undocumented service.

## 0.0.1a6: dynamic page content and source language

- Default source for **new installations** is `auto`; upgrades retain a previously
  selected fixed language, so the tested English→Czech path is not changed.
- Right-click toolbar button → **Auto-detect language → Czech** explicitly
  enables this mode. It uses the page's HTML `lang` / `xml:lang` or
  `content-language` metadata when present and passes `source=auto` to the
  original TWP Google provider when no usable language metadata exists.
  This is not an independently trained language detection model. Pages with
  incorrect language metadata may still select the wrong source language.
- When page translation is started and `extensions.twpuxp.translateDynamicContent`
  is true (default), a MutationObserver watches for **new DOM text and changes
  to existing text nodes**. New content is translated in short, debounced batches
  using the existing TWP paragraph grouping, cache and concurrent queue.
- Previously translated nodes are tracked so the add-on does **not** mistake
  its own DOM writes for fresh content. Rewritten text can be retranslated;
  restoring original page retains external updates made to the page.
- `Restore original page` and `Cancel translation` disconnect the observer.
  An endpoint failure also stops background translation to avoid retry loops.
- Right-click menu offers a toggle for dynamic translation.
- Existing icon styling remains unchanged from Noia Moon-compatible a3/a4.

### Manual checks for 0.0.1a6

1. Install over 0.0.1a4 and ensure the existing TWP toolbar icon still appears.
2. Visit English and German pages with correctly declared `<html lang>` values;
   select **Auto-detect language → Czech** and verify both translate.
3. Test a page that adds articles asynchronously; after starting translation,
   newly appended content should be translated without pressing the button again.
4. Change a DOM text node dynamically: the updated text should be translated,
   and **Restore original page** should restore the latest text supplied by the site.
5. Toggle off dynamic translation; new content must stay untranslated.
6. Test with Noia Moon and the default theme; toolbar icons must retain their geometry.

**Known limits:** This release watches the main document subtree, not separate
iframes or closed Shadow DOMs. If a site entirely replaces `document.body`, it
may need the page translator to be restarted. When the source is `auto` but no
language metadata exists, the unofficial Google endpoint performs the detection.
No real Pale Moon runtime was available for this automated build; the Node DOM
simulations are not a substitute for user verification.


## 0.0.1a6 — selected text translation

- Added **Translate selected text…** to the toolbar context menu.
- Added a conditional **Translate selected text (TWP)** item in the page context menu when there is a text selection.
- Added a standalone classic XUL result window with the original selection, translation, service status, and Copy button.
- Selection translation reuses the existing Google adapter but does not mutate page DOM or full-page translation state.
- Long selections are sent in bounded fragments, without truncation; line breaks between long fragments are not fully preserved yet.
- No changes to 0.0.1a5 full-page translator, parallel scheduling, dynamic observer, or Noia Moon toolbar styles.
- Tested through static checks and mocked XUL JS; **Pale Moon runtime testing is required**.

Build: `python3 tools/build-uxp.py /path/to/output.xpi` and run `node tools/test-a6-selection.js`.


## 0.0.1a7 — language UI and settings dialog

- The selected-text XUL window now has independent source/target dropdowns,
  **Translate** and **Swap** controls. Its text selection remains fixed while
  languages are changed; copy works on the latest completed translation.
- Languages are selected from a first subset of 22 commonly used codes; the
  full upstream language catalog is not yet ported into this UI.
- The window starts with the user's persisted source/target preferences.
  Each translation choice updates those preferences for subsequent uses.
- Auto-detect continues to honor document metadata and otherwise passes
  `auto` to the Google endpoint. Swap declines to guess a source language if
  metadata cannot determine one.
- Added **Translation preferences…** to the TWP toolbar context menu
  and the add-on manager via install.rdf `optionsURL`. This
  native XUL dialog configures source/target, dynamic translation, grouping,
  concurrency, batch size and the optional node limit. Inputs are validated
  before writing preferences; Cancel leaves settings unchanged.
- Added **Translate page (preferred languages)** to the same context menu.
  Left-click behavior is unchanged and already uses the saved direction.
- Kept the Google-only experimental provider. No unported provider is
  presented as available. The upstream service remains unofficial and subject
  to provider changes.
- No modifications to the a6 scheduler, dynamic observer, grouped DOM logic,
  icon assets or the Noia Moon-compatible CSS. Existing full-page translator
  remains the tested reference implementation.
- Static, mocked runtime and regression tests do not replace an actual
  Pale Moon 35 hands-on run.

### a7 manual tests

1. Install over a6 and confirm the same toolbar icon and page translation.
2. Select text, use page context menu, switch target from Czech to German,
   choose Translate, then Copy translation.
3. Use Swap (with a fixed source or a detected explicit HTML language).
4. Right-click TWP toolbar button → Translation preferences…, change default
   page direction and Save. Left-click TWP button on a new page to test it.
5. Confirm Cancel does not save invalid or unsaved settings, and Noia Moon
   remains unaffected.


## 0.0.1a9 - second experimental translation provider

- Ported the Bing/Edge translation protocol from upstream TWP v10.2.1.0 as a separately selectable experimental backend.
- Provider may be chosen in Translation preferences, toolbar context submenu, and selected-text window.
- Default remains Google; the selected provider also handles dynamic page updates.
- Added Bing language code normalization, batched requests, indexed-markup response mapping, and in-memory cache.
- Unofficial Microsoft Edge endpoint is not an Azure Translation API and may stop working. No live-endpoint guarantee.
- Unchanged baseline: page collector, scheduler, dynamic observer, Noia Moon icon CSS, original toolbar button ID.

### a8 manual test plan

1. Install a8 over a7 and confirm the Noia Moon toolbar icons have not changed.
2. Keep **Google** selected and confirm a full English-to-Czech page and Restore original work.
3. Right-click the toolbar icon → **Translation service → Bing Translator**. Translate the same page to Czech and restore it.
4. In **Translation preferences…**, confirm Bing is selected, save Google and ensure selection is persisted.
5. Select text → **Translate selected text** and change the service inside the XUL dialog; try switching languages and copying the translated text.
6. Test a dynamically appended paragraph with Bing selected. Error messages should display HTTP status / network failures instead of silently falling back to Google.
7. If Bing does not work in Pale Moon, switch back to Google. Report the exact error and whether the upstream Firefox TWP Bing provider works on the same network.

**Not verified:** live Bing HTTP service response in Pale Moon; available sandbox cannot access external DNS. Verified: parser/mapping, language normalization, batching, cache, alternate provider dispatch, source dialog integration, existing Google regressions.


## 0.0.1a9 — Bing HTML marker recovery

- Addresses a user-observed Bing failure: `response omitted text segment 1/3` stopped the full-page translation after 125 nodes.
- Scans nested HTML wrappers for indexed `<bNN>` nodes. If a batch response still omits indexed segments, retries only affected groups as separate single-node translation items.
- Fallback sends at most 8 individual items and roughly 800 characters per request; caches complete groups only.
- If a singleton is still untranslatable, leaves its original DOM text untouched and reports the number of omitted segments in the final status. Real network errors still surface and halt instead of silently changing providers.
- Preserves Google provider, page scheduler, dynamic translation, selected-text window and Noia Moon icon stylesheet unchanged except for error reporting.
- Mocked test fixtures are not a substitute for live Microsoft service verification in Pale Moon.


## 0.0.1a10: Preferences window layout fix
- Increased default preferences dialog height from 570 to 650 px.
- Moved all settings groupboxes into a scrollbox to support smaller displays and larger system text.
- Cancel and Save preferences remain in a fixed footer, rather than being clipped below the window.
- No changes to translation providers, scheduler, language menus, dynamic translation or Noia Moon toolbar CSS.


## a11: Upstream language catalog and automatic rules
- Imported upstream TWP v10.2.1.0 Google (250) and Bing (138) language lists and English/Czech names. The lists indicate upstream supported choices, not guaranteed live API support.
- Language dropdowns in Preferences and selection popup now follow the active provider, with safe fallback when an existing choice is unavailable.
- Opt-in automatic translation for selected hostnames (including subdomains) and page language codes, with site exclusions taking precedence; no match means no automatic translation.
- Auto translation is triggered when a document loads in the current tab or when the user switches to an already loaded tab. It does not translate background tabs or subframes.
- The page must declare its language for language-based rules. Explicit site rules also work without language metadata.
- Google/Bing request engines, Noia Moon CSS and a10 settings footer are unchanged.

### Suggested manual checks
1. Visit a page and verify normal/manual Google and Bing translation.
2. Check Preferences > service change and verify supported language lists.
3. Enable automatic rules; set `example.com` (site), then reload `https://example.com/`; verify automatic translation.
4. Put the same hostname in exclusions, reload, verify no automatic translation. Manual translation must still work.
5. Set a language rule such as `en`; verify auto translation for an English page with an `html lang`, and no change to an already-Czech page.
6. Confirm translation popup still works and Noia Moon toolbar icons are unchanged.


## 0.0.1a13 — transient Google HTTP 502 resilience

- When Google returns HTTP 408, 429, 500, 502, 503 or 504, the exact failed
  POST request is retried at most two times (650 ms then 1600 ms). Network
  failures and timeouts get the same bounded retry; permanent HTTP 4xx
  errors still fail immediately. No retries on response parsing errors.
- A transient error that persists after retries does not abort the whole page:
  the affected batch remains untranslated and the scheduler continues. A
  circuit breaker stops the page after four consecutive failed batches (or eight total failed batches) to
  avoid hammering a broken service.
- Final status reports untranslated nodes; there is no silent fallback to Bing
  or a claim that all nodes translated successfully.
- No changes to the Google request payload, HTML mapping, Noia Moon toolbar
  stylesheet, provider selection, language catalog or automatic translation rules.
- Validated in mocked XHR regression tests; requires real Pale Moon testing.


## 0.0.1a13 – Experimental DeepL storefront provider

- Ported the experimental DeepL provider from upstream TWP 10.2.1.0 (`translationService.js`, `deeplService`).
- `https://oneshot-free.www.deepl.com/v1/storefront/translate` is **undocumented** and may stop working or restrict requests at any time. This is not the official DeepL API, and no paid API key is needed for this experimental mode.
- Added DeepL to the toolbar context menu, Options service picker, and selection translation window.
- Added DeepL language catalog copied from upstream (snapshot, not a guarantee of endpoint availability).
- The DeepL UXP adapter batches individual text nodes and maps them back by index. This preserves node boundaries, but unlike the upstream Google HTML mode it does not supply inline-markup context across nodes.
- Google, Bing, page scheduler, dynamic observer, Noia Moon toolbar CSS, and default service remain unchanged.
- Live requests in Pale Moon require manual testing. Failed DeepL requests do not silently send content to Google or Bing.


## 0.0.1a16 — DeepL experimental endpoint update

- **Fixed (experimental):** Changed anonymous DeepL endpoint from `https://oneshot-free.www.deepl.com/v1/storefront/translate` (HTTP 404 reported on Pale Moon) to `https://oneshot-free.www.deepl.com/v1/translate`. This comes from public DeepLX migration work, NOT official DeepL API documentation.
- **Changed:** Send `Authorization: None`, and use the newer minimal one-shot request body (`text`, `target_lang`, optional `source_lang`). Omit source language for automatic detection.
- **Improved:** On future HTTP 404 errors show explicit advice to choose Google or Bing. No automatic forwarding of page text to a different provider.
- Google/Bing, page scheduling, Noia Moon toolbar CSS, and preferences layout are unchanged.
- **Verification:** simulated transport and regression tests only; no live DeepL call from Pale Moon was performed. The endpoint remains unofficial, unstable, and can be blocked by the service.
- References: https://git.h6.work/tanpengsccd/DeepLX/commit/98918dd9f6af0c255cbb19a10b7de4c212c68cda and https://www.deepl.com/en/developers (official, keyed API is a distinct product).


### 0.0.1a16
- Translate visible HTML text attributes (title, alt, placeholder, aria-label, aria-placeholder, button value) using the same batching and rollback pipeline.
- Optional translation of same-origin frames already loaded in the page; cross-origin and inaccessible frames are skipped.
- Dynamic attribute updates and frames participate in the same shared translation state.
- Two new preference toggles for frame/attribute translation.


### 0.0.1a16 — DeepL rate limiting observed on heavy pages
- Real-world user test: Google and Bing completed edition.cnn.com; DeepL translated 657 nodes before HTTP 429 on its undocumented anonymous endpoint. This is a service-side request limit, not a proven monthly quota.
- DeepL page requests are now serial (one in flight) and spaced by >=1250 ms; Google and Bing keep their original fast concurrency. The selection-text translator applies the same DeepL-only policy.
- DeepL HTTP 429 aborts the current translation promptly; no repeated 429 requests, no hidden proxy switching, no automatic transfer to another provider. Already translated text is preserved, and Restore original page remains available.
- Honors Retry-After if supplied, otherwise applies a conservative 60-second local cooldown to discourage accidental hammering. This is not a promise the rate limit expires after 60 seconds.
- Tested with mocked responses, not live DeepL throughput. The limits of the unofficial endpoint remain unknown and might still affect large pages.


### 0.0.1a17 — Upstream-inspired native XUL popup

- Main toolbar button now opens an anchored XUL popup modeled after upstream TWP's
  Original / Translate controls; **Ctrl+click** or **Shift+click** preserves
  the prior instant full-page translation action. The right-click menu is unchanged.
- Quick source and target language selectors, swap, and service choice are shared
  with the existing Preferences and selected-text translation window.
- Quick per-site **Always translate** and **Never auto-translate** switches update
  the same normalized rule lists used by the automatic translation engine. The
  Always option also enables automatic translation globally; exclusions win.
- Current page language, translation state, and a concise progress/status message
  appear inside the popup. Selected-text and Preferences shortcuts are included.
- New `mainPopup.js` + `mainPopup.css` only touch our own popup; `overlay.css`
  for Noia Moon and all three provider adapters are byte-identical to a16.
- All upstream files in `src/` are preserved without modification.
- **To test:** left-click TWP → panel appears; choose Google/Bing, select
  language, Translate page; Original restores. Ctrl+click still quick-translates.
  Turn on Always translate on one site, reload it, then block it via Never.
  Check a different tab, selected-text translation and Settings.
- Real runtime behavior and visual layout still require Pale Moon testing.

## 0.0.1a18: simpler artwork and upstream-style language rule

- Replaced the former moon/document icon with the user-approved blue translation
  badge (white circular language symbols and exchange arrows). Corrected the
  rough outside crop, removed the white background to transparency, and regenerated
  antialiased 16/24/32/48/64/128 px PNGs. The original approved artwork is kept
  in `uxp/artwork/twp-translation-badge-master.png`.
- Kept `overlay.css` unchanged to preserve Noia Moon toolbar geometry.
- Added **Always translate pages in [detected language]** in the main XUL popup.
  This writes to the existing `autoTranslateLanguages` preference used by upstream-like
  automatic rules and also enables `autoTranslateEnabled` when checked.
- The language checkbox is disabled if the site has no declared language, the
  language matches the target, or the provider does not list the language.
- Site-specific auto-translation exclusions still override language-wide rules.
- The translation engine, HTTP providers, scheduler, restore, selection translator
  and preference dialog logic are unchanged.

### a18 manual test

1. Update from a17. Check icon in default theme and Noia Moon, including small icons.
2. Open an English-language page that declares `lang=en`: the main popup should
   offer **Always translate pages in English**; check it and reload the page.
3. Disable that option and confirm that language-wide auto translation stops.
4. Open a site with unknown language metadata: rule checkbox must be disabled.
5. Use **Never auto-translate this site**; it must override the global language rule.
6. Verify Google and Bing whole-page translations and Restore original page.


## 0.0.1a19 — opt-in persistent translation cache

- Preserves all functional behavior of user-tested a18 and the Noia Moon-compatible toolbar icon CSS. The Google, Bing and DeepL provider source files are unchanged.
- Added `chrome/content/persistentCache.js`, a profile-local SQLite cache (`twpuxp-translations.sqlite`). Provider, language pair, translation mode (whole-page fragments vs selected text) and exact original text are included in its lookup key. No cross-provider mixing.
- Cached outputs are returned asynchronously; only missing segments are sent to the translation provider. Malformed or partial responses are never persisted. No automatic fallback to a different provider.
- Size is bounded to approximately 2500 translation entries, evicting oldest entries periodically. The existing per-provider in-memory caches remain active.
- **Privacy:** disk caching is **off by default** (`extensions.twpuxp.persistentCacheEnabled=false`), because the file can contain text from visited pages or selections. Private windows bypass disk reads AND writes. No cache text is sent anywhere except to the explicitly selected translator when a network request is necessary.
- Added a **Local translation cache** section to the existing Preferences window with an opt-in checkbox, entry count, and **Clear stored translations** button. Unchecking prevents further disk access but retains old entries until cleared.
- Tested with Node.js mocked storage API: opt-in, skip-network on hits, separate providers and request types, private browsing bypass, rejection of partial results, and cache clearing. Test on real Pale Moon is still required.

### Manual tests for a19

1. Upgrade from a18. Confirm Google/Bing whole-page translation, restore, selection popup, toolbar and Noia Moon are unaffected.
2. Open Preferences → Local translation cache, enable the checkbox and save. Translate a page over Google or Bing, then reopen Preferences and check that stored count is positive.
3. Open the same page again, translate it with the same source and target language; fewer network requests should be needed. Different source language or another provider should not reuse that result.
4. In Preferences, clear stored translations; counter should return to zero. Disable caching and verify that no new entries are stored.
5. If using a private window, confirm no disk entries are added even if the global checkbox remains enabled.

The profile-local database is intentionally not included in the XPI or source archive.


## 0.0.1a20 — original text on hover

- Optional **Show original text on hover** in the native toolbar popup and Preferences; off by default.
- Uses the original-to-translated node records already retained for Restore original page, with O(1) lookups in a WeakMap. Shows a small, delayed tooltip over translated text; never changes page text or sends additional requests.
- Works in translated content within accessible same-origin frames, in addition to the main document.
- Ignores nontranslated text and tooltip elements; hides on scroll, click and restoration; removes all listeners on restore.
- The preview is shortened to 650 characters, while translations and their stored originals remain complete.
- The toggle in the main popup takes effect immediately for the active translated page. Preferences also update the active translated tab immediately when opened from a browser window; otherwise the preference is applied on the next translation.
- No changes to Google/Bing/DeepL adapters, parallel scheduler, persistent cache or Noia Moon toolbar CSS.

### Manual verification
1. Install a20 over confirmed a19, check the new option in the popup and Preferences.
2. Translate a page with inline links and hover over translated text. Verify the displayed original, then disable the option.
3. Check Restore original page and mouse movement no longer shows the tooltip.
4. Check Noia Moon toolbar geometry and Google/Bing whole-page translation.


## 0.0.1a22: upstream-style XUL keyboard shortcuts

- `Ctrl+Alt+T` (on Linux/Windows) toggles the current page between original and translated; cancels if translation is running.
- `Ctrl+Alt+S` opens selected-text translation; `Shift+Alt+0` restores the original page.
- Uses native XUL `<keyset>` (not WebExtensions commands). Toggle all shortcuts in **Preferences → Keyboard shortcuts**; disabled keys are deactivated through the XUL `disabled` attribute.
- On KDE or other desktop environments `Ctrl+Alt+T` may be reserved globally for the terminal. If the OS captures it, the browser cannot respond. Other shortcuts and all toolbar functionality remain available.
- Adds no new network requests, database writes, or site permissions. Google/Bing/DeepL, cache, page scheduler, toolbar CSS and icons unchanged.
- These shortcuts currently use fixed upstream-compatible bindings; customizable key assignment is not yet implemented.


## 0.0.1a22 — hotkey registration fix

- Fixes keyboard shortcuts introduced in a21 that did not activate on Linux or Windows.
- Merges command keys into browser's native `<keyset id="mainKeyset">` rather than declaring an independent keyset, with a defensive JavaScript check/reparenting during window load.
- Uses explicit `control,alt` modifiers on Linux/Windows and a virtual `VK_0` key for the restore shortcut to avoid layout-dependent `Shift+Alt+0` text output.
- Does not change translation providers, page scheduler, popup, persistent cache, or Noia Moon toolbar styling.
- The native XUL key bindings must still be validated in Pale Moon; unit tests cannot emulate platform keyboard dispatch.
- Shortcuts: Ctrl+Alt+T toggle translation; Ctrl+Alt+S selected text; Shift+Alt+0 restore.


## 0.0.1a23 — configurable shortcuts

- Three independent shortcut fields in Preferences → Keyboard shortcuts. Click one and press the desired combination; Esc cancels, Backspace/Delete or Clear disables, Default restores the original combination. Confirm with OK.
- Valid shortcuts require Ctrl, Alt or Meta, combined with a letter, top-row digit, F1–F12 or navigation key; Shift is optional. The editor detects duplicates across the three TWP actions before saving.
- Settings are stored under `extensions.twpuxp.shortcutToggle`, `shortcutSelection`, and `shortcutRestore` (empty value means disabled); the master `keyboardShortcutsEnabled` toggle is retained.
- Native browser-window XUL keys are rebuilt on settings changes in the active `mainKeyset`. Preferences observers update all open browser windows; the options opener also receives an explicit sync as fallback. No browser restart should be required.
- Uses no WebExtensions API, has no influence on translation providers, cache or Noia Moon toolbar CSS. Desktop/system hotkeys may take precedence and cannot be detected.

### Manual verification

1. Update a22 → a23. Verify the three old defaults still work (outside KDE's reserved Ctrl+Alt+T).
2. Preferences → Keyboard shortcuts: click Translate / restore page, press Ctrl+Alt+Y, OK. Confirm the new binding works without restart and old Ctrl+Alt+T no longer triggers TWP.
3. Change Translate selection, verify it works; attempt duplicate Ctrl+Alt+Y and confirm rejection.
4. Clear Restore original, OK. Verify this action is disabled while the other two remain functional.
5. Reset bindings to Default; test master switch off/on and behavior in multiple open browser windows.


## 0.0.1a24 — exclude page languages from automatic translation

- Adds **Never auto-translate pages in [detected language]** to the native toolbar popup, matching the corresponding upstream TWP language exclusion concept. The item is disabled if the page language cannot be identified or equals the target language.
- Adds **Never auto-translate these page languages** to Preferences → Automatic translation rules. Rules use the existing provider-aware language catalog and are stored in `extensions.twpuxp.neverTranslateLanguages`; default is empty, so existing installations behave identically until the option is enabled.
- **Exclusion precedence:** excluded hostname > excluded detected language > same as target > explicit allowed site > allowed language. Thus an excluded language cannot auto-translate even on an otherwise allowed site. Manual translation and selected-text translation remain available.
- Choosing Always/Never for a language in the popup removes the conflicting entry from the opposite list. The Preferences editor allows both; Never takes precedence on automatic translation.
- No changes to translation provider endpoints, concurrent scheduler, cache, toolbar CSS, keyboard shortcuts, or icon.

### Manual verification for a24
1. Upgrade from tested a23. Open an English site with `html lang=en`; check that both language-rule choices are visible in the popup.
2. Enable **Never auto-translate pages in English**; also allow the current site, then reload. Confirm English is left untouched.
3. Manually press Translate page; confirm translation still works.
4. In Preferences verify `en` in Never languages. Turn the Never toggle off and enable Always for English; reload to confirm automatic translation works again.
5. Check unknown-language pages (the language rule checkboxes should be disabled) and verify the new rule also works with Bing.


## 0.0.1a25 – popup width and edge-alignment fix

- Stabilized the XUL popup at 400 CSS pixels rather than allowing checkboxes
  and site/state/notice labels to grow its intrinsic width.
- Crops overlong checkbox and state labels, keeping the complete language rule
  details available in a tooltip. Compact labels say, for example,
  **Never auto-translate: English**. Existing checkbox behavior is unchanged.
- Aligns the popup to the **right** edge of the toolbar icon when its default
  left alignment would cross the right edge of the browser window.
- Translation adapters, SQLite cache, shortcut mapping, icons and Noia Moon
  toolbar rules are unchanged from user-tested a24.
- Manual check: open the popup near the browser's right edge, toggle site,
  language and hover options in turn, and confirm Preferences remains visible.


## 0.0.1a26 – anonymous translation network requests

- All XHR calls (Google key lookup and translateHtml, Bing, DeepL) use the
  same `TWPUXPPrivacyXHR.create(method, url)` adapter.
- New **Privacy and network requests** preference `privacyEnhancedRequests`
  defaults **on**. With this enabled the request's channel must accept
  `nsIRequest.LOAD_ANONYMOUS`, and the HTTP referrer must be empty/clearable;
  otherwise the request is **not sent** and a diagnostic error is displayed.
  It is possible to turn the option off for compatibility (standard XHR).
- `mozAnon:true` is attempted where UXP accepts constructor options but is
  never used as the sole line of defense; chrome XHR implementations vary.
- No changes to Google/Bing/DeepL request bodies, endpoint URLs, key fetch,
  performance policy, cache, toolbar icons, or popup.
- HTTPS is enforced for translation destinations in both modes.
- Does **not** hide network IP, translated content, connection metadata,
  provider-specific request headers, or automatically guarantee a particular
  Origin header. `Authorization: None` remains for unofficial DeepL endpoint;
  it is a static service protocol value, not a user's login credential.
- `LOAD_ANONYMOUS` may prevent HTTP proxy authentication. Users of an
  authenticated proxy may need to disable this option, understanding the
  tradeoff. Network observation in **real** Pale Moon/UXP is still required
  to verify final headers and redirects; mocked Node tests only verify our
  call path and channel setup.

### Manual a26 checklist
1. Install over `a25` and restart Pale Moon; verify the Privacy checkbox is ON.
2. Test Google full-page and selected text (including initial key download).
3. Test Bing full-page and selected text. DeepL remains optional/rate-limited.
4. Repeat using a second Pale Moon window and confirm same results.
5. Optional: inspect requests in an isolated local test setup or trusted
   HTTPS endpoint to confirm actual headers for this UXP version.
6. If any provider reports `TWP privacy mode: cannot enable...`, capture the
   full error; disabling the option restores conventional network requests.


## 0.0.1a27 — privacy terminology and Customize Toolbar icon

- Changed only the user-facing privacy setting label from **Anonymous translation requests** to **Privacy-enhanced translation requests**. The text explains what is suppressed and that IP address and translated text remain visible to providers. Existing preference key `extensions.twpuxp.privacyEnhancedRequests` and network implementation remain unchanged.
- Added the missing `chrome.manifest` stylesheet registration for `chrome://global/content/customizeToolbar.xul`. In the separate Customize Toolbar window the theme otherwise supplied a full toolbar sprite instead of TWP's own icon.
- Added narrowly-scoped `#wrapper-twpuxp-page-button` and `.toolbarbutton-icon` safeguards. No fixed icon geometry, global button selectors or changes to other add-ons/themed icons. The live normal and small toolbar icon assets are unchanged.

Test in Pale Moon 35: remove the TWP button into Customize palette, confirm only the blue TWP badge is shown, drag it back, then verify both large/small icons and Noia Moon neighboring buttons. Check the privacy checkbox label and Google/Bing translation are unaffected.
