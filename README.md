# TWP for Pale Moon

**Unofficial native UXP port** of [TWP — Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web) for the **Pale Moon** web browser.

**Current beta: 1.0.0b3** · Primary browser: Pale Moon 35 · **MPL 2.0**

This project is a community port and is **not affiliated with or endorsed by** the original TWP developer.

> **1.0.0b3 — Third public beta:** Adds JSON settings backup/restore, eight UI languages, favorite targets, a custom dictionary, and improved translation-service error handling. The final a7 stabilization changed no translation logic.

## Features

- Translate complete web pages and selected text directly in the tab.
- Google Translate and Bing Translator support; optional, experimental DeepL.
- Source/target language selection, automatic translation rules, restore original text.
- Dynamic page content, accessible same-origin frames and text attributes.
- Persistent translation cache (optional, **disabled by default**), and privacy-enhanced requests (**enabled by default**).
- Keyboard shortcuts, original-text-on-hover and customizable toolbar button.
- Optional on-page progress notifications (**disabled by default**); errors remain visible.
- Improved multiline selection and Markdown/README change-history translation with preserved line breaks and blank lines.
- Page context submenu: translate, always translate the current site, forget that site’s translation preference, restore original.
- Basic Basilisk 52.9.x compatibility (toolbar-placement preservation verified by the maintainer).
- Native XUL UI localization in eight languages (English, Czech, German, French, Spanish, Polish, Slovak, Italian).
- Up to three favorite target languages in the translation popup.
- Optional custom dictionary for exact terms and replacements, included in JSON settings backup.

## Installation

Install `TWP-for-Pale-Moon-UXP-1.0.0b3.xpi` from the GitHub Release once published, or install the XPI through the browser Add-ons Manager. Upgrading from the b1/b2 releases or b3 test builds retains the add-on ID and saved preferences. The manifest declares Pale Moon **33.0–35.*** and Basilisk **52.9.0–52.9.***. The Basilisk compatibility target uses the historical Firefox application ID; it does **not** imply compatibility with Firefox or full regression coverage in Basilisk. Pale Moon remains the primary target.

## Build and test

Python 3, Node.js (for the tests only):

```sh
python3 tools/build-uxp.py
python3 tools/run-uxp-tests.py
```

The XPI is built from `uxp/` and does not embed the original WebExtension source. The `src/` directory contains a preserved upstream source snapshot required for source completeness and referenced by some build checks. For implementation details, see [the port guide](UXP-PORT-README.md) and [the changelog](CHANGELOG-UXP.md).

## Privacy and limitations

Translation text is sent to the selected provider. Privacy-enhanced requests reduce metadata disclosure where supported, but **do not provide anonymity**. Providers use unofficial endpoints which may change or reject requests; DeepL in particular may rate-limit translation of long pages. Never translate sensitive page content through an untrusted third-party service. See [privacy notes](docs/PRIVACY-UXP.md).

## License, credits, and artwork

The upstream TWP source is by FilipePS and contributors, licensed under Mozilla Public License 2.0. The port preserves that license and source attribution. See [LICENSE](LICENSE) and [CREDITS-UXP.md](CREDITS-UXP.md).

The blue project-specific translation icon was generated using ChatGPT, revised by the maintainer, then finalized for this port. Its original image reference and working assets are retained in [`uxp/artwork/`](uxp/artwork/). **The artwork is not a copy of the original TWP icons.**

This repository includes the original upstream source for reference and license compliance. The upstream project's own README has been moved to [`upstream/README-original-TWP.md`](upstream/README-original-TWP.md) to avoid confusion with the port.

> **Previous release:** [1.0.0b2 notes](docs/RELEASE-NOTES-1.0.0b2.md). See [1.0.0b3 notes](docs/RELEASE-NOTES-1.0.0b3.md) for this beta.
