# TWP for Pale Moon

**Unofficial native UXP port** of [TWP — Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web) for the **Pale Moon** web browser.

**Current version: 1.0.0b1 (beta)** · Maintainer-tested in Pale Moon 35 · **MPL 2.0**

This project is a community port and is **not affiliated with or endorsed by** the original TWP developer.

## Features

- Translate complete web pages and selected text directly in the tab.
- Google Translate and Bing Translator support; optional, experimental DeepL.
- Source/target language selection, automatic translation rules, restore original text.
- Dynamic page content, accessible same-origin frames and text attributes.
- Persistent translation cache (optional, **disabled by default**), and privacy-enhanced requests (**enabled by default**).
- Keyboard shortcuts, original-text-on-hover and customizable toolbar button.
- Optional on-page progress notifications (**disabled by default**); errors remain visible.

## Installation

Install `TWP-for-Pale-Moon-UXP-1.0.0b1.xpi` from the GitHub Releases area once published, or use the separately supplied beta XPI. Updating over `0.0.1a33` retains the extension ID and existing preferences. Supported version metadata declares Pale Moon 33.0–35.*, with practical validation so far in Pale Moon 35.

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
